import Link from "next/link";
export default function Page() { return <section className="access-denied"><span className="overline overline--accent">403 / ACCESS</span><h1>Недостаточно прав</h1><p>Эта область доступна только администратору. Ограничение проверяется также на сервере.</p><Link className="text-link" href="/admin">← Вернуться к обзору</Link></section>; }
