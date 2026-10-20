import { useEffect, useRef, type ReactNode } from 'react';
export function Dialog({ title, close, children }: {
    title: string;
    close: () => void;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const prior = document.activeElement as HTMLElement | null; ref.current?.showModal(); return () => { ref.current?.close(); prior?.focus(); }; }, []);
    return <dialog className="bb-dialog" ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); close(); }}><header><h2>{title}</h2><button onClick={close} aria-label={'Close ' + title}>Close</button></header>{children}</dialog>;
}
