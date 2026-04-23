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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '-0.5px',
          }}
        >
          <span style={{ color: '#ce2b37' }}>Chefs</span>
          <span style={{ color: '#1a1a1a' }}>book</span>
        </span>
        <img
          src="/images/chefs-hat.png"
          alt=""
          width={48}
          height={48}
          style={{ objectFit: 'contain' }}
        />
      </div>
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
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
