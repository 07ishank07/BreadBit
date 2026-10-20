import type { SchematicScene } from './schematic';
export interface PdfOptions {
    paper: 'A4' | 'Letter';
    landscape: boolean;
    partsList: boolean;
}
const safe = (s: string) => s.replace(/Ω/g, 'ohm').replace(/µ/g, 'u').replace(/·/g, '-').normalize('NFKD').replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');
/** Small vector PDF writer. The same drawing primitives drive SVG and PDF. */
export function schematicPdf(scene: SchematicScene, title: string, revision: number, options: PdfOptions): Uint8Array {
    const size = options.paper === 'A4' ? [595.28, 841.89] : [612, 792];
    const [w, h] = options.landscape ? [size[1], size[0]] : size;
    const pages: string[] = [];
    const columns = Math.max(1, Math.ceil(scene.width / 1100)), rows = Math.max(1, Math.ceil(scene.height / 650));
    for (let row = 0; row < rows; row++)
        for (let col = 0; col < columns; col++) {
            const scale = Math.min((w - 60) / 1100, (h - 140) / 650);
            let stream = '0.15 0.2 0.2 RG 0.7 w\n30 '+(h-58)+' '+(w-60)+' 46 re S\n';
            const txt = (x: number, y: number, text: string, size = 10) => { stream += 'BT /F1 ' + size + ' Tf ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' Td (' + safe(text) + ') Tj ET\n'; };
            txt(30, h - 30, title, 16);
            txt(30, h - 48, 'Revision ' + revision + ' | ' + options.paper + ' | Sheet ' + (pages.length + 1) + ' | Nets labeled N#');
            stream += 'q 30 70 ' + (w - 60) + ' ' + (h - 140) + ' re W n\n';
            const xy = (x: number, y: number) => [(30 + (x - col * 1100) * scale).toFixed(2), (h - 70 - (y - row * 650) * scale).toFixed(2)];
            for (const d of scene.drawing) {
                if (d.kind === 'text') {
                    const [x, y] = xy(d.x, d.y);
                    txt(Number(x), Number(y), d.text, (d.size ?? 12) * scale);
                }
                else if (d.kind === 'line') {
                    stream += (d.dash ? '[3 2] 0 d' : '[] 0 d') + '\n';
                    d.points.forEach((p, i) => { const [x, y] = xy(p.x, p.y); stream += x + ' ' + y + (i ? ' l' : ' m') + '\n'; });
                    stream += 'S\n';
                }
                else {
                    const [x, y] = xy(d.x, d.y), r = d.r * scale;
                    const cx=Number(x),cy=Number(y),k=r*.55228475;stream+=`${cx+r} ${cy} m ${cx+r} ${cy+k} ${cx+k} ${cy+r} ${cx} ${cy+r} c ${cx-k} ${cy+r} ${cx-r} ${cy+k} ${cx-r} ${cy} c ${cx-r} ${cy-k} ${cx-k} ${cy-r} ${cx} ${cy-r} c ${cx+k} ${cy-r} ${cx+r} ${cy-k} ${cx+r} ${cy} c f\n`;
                }
            }
            stream += 'Q\n';
            txt(30, 42, scene.warnings.length ? 'UNRESOLVED: ' + scene.warnings.length + ' mappings. Review in app before use.' : 'Connectivity uses host pin mappings; not an electrical safety certification.', 9);
            pages.push(stream);
        }
    if (options.partsList) {
        let stream = '';
        scene.symbols.forEach((s, i) => { if (i % 38 === 0) {
            if (stream)
                pages.push(stream);
            stream = 'BT /F1 16 Tf 30 ' + (h - 30) + ' Td (Parts list - ' + safe(title) + ') Tj ET\n';
        } stream += 'BT /F1 11 Tf 30 ' + (h - 60 - (i % 38) * 16) + ' Td (' + safe(s.id + ' - ' + s.kind + ' ' + (s.value ?? '')) + ') Tj ET\n'; });
        if (stream)
            pages.push(stream);
    }
    const objects: string[] = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
    const kids: number[] = [];
    for (const stream of pages) {
        const page = objects.length + 1, content = page + 1;
        kids.push(page);
        objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + w + ' ' + h + '] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + content + ' 0 R >>', '<< /Length ' + stream.length + ' >>\nstream\n' + stream + 'endstream');
    }
    objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[1] = '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((o, i) => { offsets.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xref = pdf.length;
    pdf += 'xref\n0 ' + offsets.length + '\n0000000000 65535 f \n';
    for (const n of offsets.slice(1))
        pdf += String(n).padStart(10, '0') + ' 00000 n \n';
    pdf += 'trailer\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    return new TextEncoder().encode(pdf);
}
export function downloadBlob(content: BlobPart, name: string, type = 'application/json') { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
