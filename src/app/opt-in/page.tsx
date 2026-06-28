export default function OptIn() {
  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "60px auto", padding: "0 24px" }}>
      <h1>SMS Opt-In</h1>
      <p>
        This is a private, single-user task management tool. The owner of this
        application has opted in to send SMS messages from their personal phone
        number to a dedicated Twilio number. Those messages are received by this
        application and saved as personal tasks.
      </p>
      <h2>How it works</h2>
      <ul>
        <li>The application owner texts a task (e.g. "Buy groceries") to the registered number.</li>
        <li>The message is received by a private webhook and stored in a personal dashboard.</li>
        <li>No outbound messages are sent to any recipient.</li>
        <li>No third parties are messaged or opted in.</li>
      </ul>
      <h2>Opt-out</h2>
      <p>
        To stop, the owner simply stops texting the number. Texting STOP will
        also unsubscribe from any future messages.
      </p>
      <h2>Contact</h2>
      <p>purgasonalexp@gmail.com</p>
    </main>
  );
}
