// Stub for sending emails
export const sendEmail = async (to, subject, text) => {
  // Replace with nodemailer or a transactional provider when wiring real email.
  console.log(`Email sent to ${to}: ${subject} - ${text}`);
};
