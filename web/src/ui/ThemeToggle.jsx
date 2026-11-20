// Sun/moon switch between light and dark glass.
export default function ThemeToggle({ theme, onChange, className = '' }) {
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      aria-label={dark ? 'Treci la tema luminoasă' : 'Treci la tema întunecată'}
      title={dark ? 'Temă luminoasă' : 'Temă întunecată'}
      onClick={() => onChange(dark ? 'light' : 'dark')}
    >
      {dark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
