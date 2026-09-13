// Логотип шоу: гранёный единорог и надпись «Oskar Hartmann» (основатель и ведущий шоу).
// Файл: web/public/brand/logo-oskar-hartmann.png. Размер задаётся классом высоты.
export function Logo({ className = 'h-7' }: { className?: string }) {
  return <img src="./brand/logo-oskar-hartmann.png" alt="Oskar Hartmann" className={`${className} w-auto self-start shrink-0 object-contain select-none`} draggable={false} />
}
