export default function Loading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#faf7f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <img
        src="/images/chefs-hat.png"
        alt="ChefsBook"
        width={120}
        height={120}
        style={{ marginBottom: 24, objectFit: 'contain' }}
      />
      <span
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 36,
          fontWeight: 700,
          color: '#1a1a1a',
          letterSpacing: '-0.5px',
          marginBottom: 8,
        }}
      >
        ChefsBook
      </span>
      <span
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 16,
          fontWeight: 400,
          color: '#7a6a5a',
        }}
      >
        Welcome to ChefsBook
      </span>
    </div>
  );
}
