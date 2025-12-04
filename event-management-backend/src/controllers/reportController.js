import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import Event from '../models/Event.js';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';

// Helper to format date
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const generateEventReport = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid Event ID' });
        }

        const event = await Event.findById(req.params.id)
            .populate('attendees')
            .populate('coordinators');

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const { summary, photos } = req.body;

        // Set margins to accommodate the large header
        const doc = new PDFDocument({ margins: { top: 160, bottom: 50, left: 50, right: 50 } });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=report-${event.eventID || event._id}.pdf`);

        doc.pipe(res);

        // --- HEADER (Letterhead) ---
        const logoPath = path.join(process.cwd(), 'assets', 'mit-logo.jpg');

        const drawHeader = () => {
            if (fs.existsSync(logoPath)) {
                try {
                    // Full width header in the top margin area
                    doc.image(logoPath, 50, 20, { width: 500 });
                } catch (err) {
                    console.error('Error loading logo:', err);
                }
            }
        };

        // Draw header on the first page
        drawHeader();

        // Draw header on all subsequent pages
        doc.on('pageAdded', drawHeader);

        // No need for manual moveDown(8) as top margin handles the spacing now

        // --- TITLE ---
        doc.fontSize(14).font('Helvetica-Bold').text(event.department || 'Department of Computer Science', { align: 'center' });
        doc.fontSize(12).text('Report on', { align: 'center', underline: true });
        doc.moveDown(0.5);
        doc.fontSize(14).text(`"${event.name}"`, { align: 'center' });
        doc.moveDown(2);

        // --- BODY ---
        doc.fontSize(11).font('Helvetica').text(
            `${event.department || 'The Department'} has organized a event on ${formatDate(event.date)} on '${event.name}'. The details of the same are given below:`,
            { align: 'justify' }
        );
        doc.moveDown();

        // --- DETAILS LIST ---
        const details = [
            { label: 'Date', value: formatDate(event.date) },
            { label: 'Time', value: event.time || 'N/A' },
            { label: 'Venue', value: event.location || 'N/A' },
            { label: 'Guest Speakers', value: event.guestSpeakers?.length ? event.guestSpeakers.join(', ') : 'N/A' },
            { label: 'Participants', value: `${event.attendees?.length || 0} participants` },
            { label: 'SDGs covered', value: event.sdg?.length ? event.sdg.join(', ') : 'None' },
            { label: 'Conducted by', value: event.department || 'N/A' },
            { label: 'Coordinators', value: event.coordinators?.map(c => c.name).join(', ') || 'N/A' },
        ];

        details.forEach(item => {
            doc.font('Helvetica-Bold').text(`•  ${item.label}: `, { continued: true });
            doc.font('Helvetica').text(item.value);
            doc.moveDown(0.3);
        });

        doc.moveDown(2);

        // --- SESSION DETAILS ---
        doc.fontSize(12).font('Helvetica-Bold').text('Session-wise Details:');
        doc.moveDown(0.5);

        // Use provided summary or fallback to event description
        const reportSummary = summary || event.description || 'No detailed description provided.';
        doc.fontSize(11).font('Helvetica').text(reportSummary, { align: 'justify' });

        // Add Agenda items if any
        if (event.agenda && event.agenda.length > 0) {
            doc.moveDown();
            event.agenda.forEach((item, index) => {
                doc.text(`${index + 1}. ${item.title} (${item.startTime} - ${item.endTime}) - ${item.speaker || ''}`);
            });
        }

        // --- PHOTOS ---
        if (photos && photos.length > 0) {
            photos.forEach((photoBase64, index) => {
                // Add new page for every 2 photos
                if (index % 2 === 0) {
                    doc.addPage();
                    // Add title only on the first page of photos
                    if (index === 0) {
                        doc.fontSize(14).font('Helvetica-Bold').text('Event Photos', { align: 'center', underline: true });
                        doc.moveDown();
                    }
                }

                try {
                    // Remove data:image/jpeg;base64, prefix if present
                    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
                    const buffer = Buffer.from(base64Data, 'base64');

                    // Add image, fitting within page width and restricted height to fit 2 per page
                    // A4 height ~840. Top margin 160, bottom 50. Usable = 630.
                    // 2 images + spacing. Max height 280 each leaves 70 for spacing/titles.
                    doc.image(buffer, { fit: [500, 280], align: 'center' });
                    doc.moveDown(2); // Padding between images
                } catch (err) {
                    console.error('Error adding photo to PDF:', err);
                    doc.text('[Error adding photo]', { align: 'center' });
                    doc.moveDown();
                }
            });
        }

        doc.end();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error generating report', error: error.message });
        }
    }
};

export const exportEvents = async (req, res) => {
    try {
        const events = await Event.find()
            .populate('coordinators', 'name email')
            .sort({ date: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Annual Report');

        worksheet.columns = [
            { header: 'Event Name', key: 'name', width: 30 },
            { header: 'Event Title', key: 'title', width: 30 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Time', key: 'time', width: 15 },
            { header: 'Coordinator Name', key: 'coordinator', width: 30 },
            { header: 'Participant Count', key: 'participantCount', width: 20 },
            { header: 'SDGs', key: 'sdg', width: 40 },
        ];

        events.forEach(event => {
            const coordinatorNames = event.coordinators?.map(c => c.name).join(', ') || 'N/A';

            worksheet.addRow({
                name: event.name,
                title: event.name, // Mapping name to title as they are stored as 'name' in DB
                date: formatDate(event.date),
                time: event.time || 'N/A',
                coordinator: coordinatorNames,
                participantCount: (event.attendance?.length || 0) + (event.attendees?.length || 0), // Sum of marked attendance and registered attendees
                sdg: event.sdg?.join(', ') || 'None',
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=annual-report.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Excel Export Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error exporting data', error: error.message });
        }
    }
};
