// Star rating (3 stars, partial support via two layers).
export default function StarRating({ value, size = '1.3rem' }: { value: number; size?: string }) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${value} жұлдыз`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= value ? 'on' : 'off'}>{i <= value ? '★' : '☆'}</span>
      ))}
    </span>
  );
}
