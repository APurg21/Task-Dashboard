export default function Privacy() {
  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "60px auto", padding: "0 24px" }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> June 2026</p>

      <p>
        This application is a private, single-user task management tool owned
        and operated by Alex Purgason. This policy describes how data is
        handled.
      </p>

      <h2>Data Collected</h2>
      <p>
        The only data collected is SMS message content sent by the application
        owner to a registered Twilio phone number. This content is stored as
        personal task entries in a private database.
      </p>

      <h2>How Data Is Used</h2>
      <p>
        Message content is used solely to populate the owner's personal task
        dashboard. No data is shared with third parties, sold, or used for
        marketing purposes.
      </p>

      <h2>Data Storage</h2>
      <p>
        Tasks are stored in Vercel KV, a cloud key-value store. Data is
        accessible only to the application owner.
      </p>

      <h2>Third-Party Services</h2>
      <ul>
        <li><strong>Twilio</strong> — receives inbound SMS and forwards to this application via webhook.</li>
        <li><strong>Vercel</strong> — hosts the application and database.</li>
      </ul>

      <h2>No Third-Party Messaging</h2>
      <p>
        No outbound SMS messages are sent to any person other than the
        application owner. No third-party phone numbers are collected or
        contacted.
      </p>

      <h2>Contact</h2>
      <p>purgasonalexp@gmail.com</p>
    </main>
  );
}
