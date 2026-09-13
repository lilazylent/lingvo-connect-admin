import Link from "next/link";

export function AuthLayout({ eyebrow, title, text, children }: { eyebrow: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-brand">
        <Link href="/" className="brand" aria-label="Лингво Коннект — админ-панель">
          <span className="brand__monogram">LC/</span>
          <span className="brand__wordmark"><strong>Лингво Коннект</strong><small>АДМИН-ПАНЕЛЬ</small></span>
        </Link>
        <div className="auth-brand__copy">
          <span className="overline">Защищённая рабочая среда</span>
          <p>Заявки, клиенты и заказы — в единой системе с контролем доступа и историей действий.</p>
        </div>
        <span className="auth-brand__index">SEC / 01</span>
      </div>
      <section className="auth-panel">
        <div className="auth-panel__inner">
          <span className="overline overline--accent">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="lead">{text}</p>
          {children}
        </div>
        <footer className="auth-footer"><span>Лингво Коннект</span><span>Доступ только для сотрудников</span></footer>
      </section>
    </main>
  );
}
