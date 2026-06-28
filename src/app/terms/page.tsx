export default function Terms() {
  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "60px auto", padding: "0 24px" }}>
      <h1>Terms of Service</h1>
      <p><strong>Last updated:</strong> June 2026</p>

      <p>
        This application is a private, single-user task management tool owned
        and operated by Alex Purgason. By using this application, you agree to
        the following terms.
      </p>

      <h2>Use</h2>
      <p>
        This service is for personal use only. The sole authorized user is the
        application owner. No third parties are permitted to use this service.
      </p>

      <h2>SMS Messaging</h2>
      <p>
        The owner may send SMS messages from their personal phone number to a
        registered Twilio number. These messages are received and stored as
        personal tasks. No outbound SMS messages are sent to any recipient.
        Message and data rates from your carrier may apply.
      </p>

      <h2>Opt-Out</h2>
      <p>
        To stop SMS functionality, the owner may text STOP to the registered
        number at any time.
      </p>

      <h2>Contact</h2>
      <p>purgasonalexp@gmail.com</p>
    </main>
  );
}
