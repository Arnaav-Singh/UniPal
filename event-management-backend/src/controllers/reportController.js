import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import Event from '../models/Event.js';
import Feedback from '../models/Feedback.js';
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
            .populate('coordinators')
            .populate('attendanceLog.user', 'name email role registrationId section semester');

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const feedbacks = await Feedback.find({ event: req.params.id }).populate('user');

        const { summary, photos } = req.body;

        // Set margins to accommodate the large header
        const doc = new PDFDocument({ margins: { top: 160, bottom: 50, left: 50, right: 50 } });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=report-${event.eventID || event._id}.pdf`);

        doc.pipe(res);

        // --- HEADER (Letterhead) ---
        const logoPath = path.join(process.cwd(), 'assets', 'mit-logo.jpg');
        const sdgLogoPath = path.join(process.cwd(), 'assets', 'sdg_logo.png');

        const drawHeader = () => {
            if (fs.existsSync(logoPath)) {
                try {
                    // Full width header in the top margin area
                    doc.image(logoPath, 50, 20, { width: 450 });
                } catch (err) {
                    console.error('Error loading logo:', err);
                }
            }

            if (fs.existsSync(sdgLogoPath)) {
                try {
                    // SDG logo at the top right
                    doc.image(sdgLogoPath, 530, 20, { width: 80 });
                } catch (err) {
                    console.error('Error loading SDG logo:', err);
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
            { label: 'Participants', value: `${(event.attendance?.length || 0) + (event.attendees?.length || 0)} participants` },
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

        // --- SDG LOGOS ---
        console.log('Event SDG data:', event.sdg); // Debug log
        if (event.sdg && event.sdg.length > 0) {
            const startX = 50;
            let x = startX;
            let y = doc.y;
            const size = 40;
            const spacing = 10;
            const pageWidth = doc.page.width - 50; // Right margin

            event.sdg.forEach(sdgString => {
                console.log('Processing SDG string:', sdgString); // Debug log
                // Extract number from "SDG1: No Poverty" -> "1"
                const match = sdgString.match(/SDG(\d+)/);
                if (match) {
                    const number = match[1].padStart(2, '0'); // "01", "10"
                    const filename = `E-WEB-Goal-${number}.png`;
                    const sdgPath = path.join(process.cwd(), 'assets', 'sdg', filename);
                    console.log('SDG Path:', sdgPath); // Debug log
                    console.log('File exists:', fs.existsSync(sdgPath)); // Debug log

                    if (fs.existsSync(sdgPath)) {
                        // Check if logo fits on current line
                        if (x + size > pageWidth) {
                            x = startX;
                            y += size + spacing;
                        }

                        try {
                            doc.image(sdgPath, x, y, { width: size });
                            x += size + spacing;
                        } catch (err) {
                            console.error(`Error loading SDG image ${filename}:`, err);
                        }
                    }
                } else {
                    console.log('No match for regex /SDG(\d+)/'); // Debug log
                }
            });
            // Adjust doc.y to be below the last row of logos
            doc.y = y + size + 20;
        } else {
            console.log('No SDGs found for this event.'); // Debug log
        }

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

        // --- ATTENDANCE LIST ---
        if (event.attendanceLog && event.attendanceLog.length > 0) {
            doc.addPage();
            doc.fontSize(14).font('Helvetica-Bold').text('Attendance List', { align: 'center', underline: true });
            doc.moveDown();

            // Group attendance by dayDate for multi-day events
            const byDay = new Map();
            event.attendanceLog.forEach((entry) => {
                const day = entry.dayDate || 'all';
                if (!byDay.has(day)) byDay.set(day, []);
                byDay.get(day).push(entry);
            });

            const isMultiDay = byDay.size > 1 || (byDay.size === 1 && !byDay.has('all'));

            const drawTableHeader = () => {
                const startY = doc.y;
                doc.fontSize(12).font('Helvetica-Bold');
                // Total width 500 (from X=50 to X=550)
                doc.text('Name', 50, startY, { width: 140 });
                doc.text('Reg No', 190, startY, { width: 80 });
                doc.text('Sec', 270, startY, { width: 40 });
                doc.text('Sem', 310, startY, { width: 40 });
                doc.text('Check-in Time', 350, startY, { width: 200, align: 'right' });
                doc.moveDown(0.5);
                doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
                doc.moveDown(0.5);
                doc.font('Helvetica').fontSize(11);
            };

            for (const [day, entries] of byDay) {
                if (isMultiDay) {
                    if (doc.y > 680) {
                        doc.addPage();
                    }
                    doc.fontSize(12).font('Helvetica-Bold').text(`Date: ${day}`, { underline: true });
                    doc.moveDown(0.5);
                }

                drawTableHeader();

                entries.forEach((entry) => {
                    if (doc.y > 750) {
                        doc.addPage();
                        if (isMultiDay) {
                            doc.fontSize(14).font('Helvetica-Bold').text(`Attendance – ${day} (Cont.)`, { align: 'center', underline: true });
                        } else {
                            doc.fontSize(14).font('Helvetica-Bold').text('Attendance List (Cont.)', { align: 'center', underline: true });
                        }
                        doc.moveDown();
                        drawTableHeader();
                    }

                    const name = entry.user ? entry.user.name : 'Unknown User';
                    const regNo = (entry.user && entry.user.registrationId) ? entry.user.registrationId : '-';
                    const section = (entry.user && entry.user.section) ? entry.user.section : '-';
                    const semester = (entry.user && entry.user.semester) ? entry.user.semester.toString() : '-';
                    const time = entry.capturedAt ? new Date(entry.capturedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A';

                    const rowY = doc.y;
                    doc.text(name, 50, rowY, { width: 140 });
                    doc.text(regNo, 190, rowY, { width: 80 });
                    doc.text(section, 270, rowY, { width: 40 });
                    doc.text(semester, 310, rowY, { width: 40 });
                    doc.text(time, 350, rowY, { width: 200, align: 'right' });
                    doc.moveDown(0.5);
                });

                if (isMultiDay) doc.moveDown();
            }
        }

        // --- FEEDBACK LIST ---
        if (feedbacks && feedbacks.length > 0) {
            doc.addPage();
            doc.fontSize(14).font('Helvetica-Bold').text('Feedback List', { align: 'center', underline: true });
            doc.moveDown();

            // Table Header
            const drawFeedbackTableHeader = () => {
                const startY = doc.y;
                doc.fontSize(12).font('Helvetica-Bold');
                doc.text('Name', 50, startY, { width: 150 });
                doc.text('Rating', 200, startY, { width: 50, align: 'center' });
                doc.text('Comment', 270, startY, { width: 280 });

                doc.moveDown(0.5);
                doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
                doc.moveDown(0.5);
                doc.font('Helvetica').fontSize(11);
            };

            drawFeedbackTableHeader();

            feedbacks.forEach((feedback) => {
                if (doc.y > 700) { // Check for end of page
                    doc.addPage();
                    doc.fontSize(14).font('Helvetica-Bold').text('Feedback List (Cont.)', { align: 'center', underline: true });
                    doc.moveDown();
                    drawFeedbackTableHeader();
                }

                const name = feedback.user ? feedback.user.name : 'Anonymous';
                const rating = feedback.rating ? `${feedback.rating}/5` : 'N/A';
                const comment = feedback.comments || '-';

                const rowY = doc.y;
                doc.text(name, 50, rowY, { width: 150 });
                doc.text(rating, 200, rowY, { width: 50, align: 'center' });
                doc.text(comment, 270, rowY, { width: 280 });
                doc.moveDown(1); // Extra spacing for potentially long comments
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
