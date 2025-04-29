import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import Database from 'better-sqlite3';

export async function POST(req) {
  const data = await req.formData();
  const files = data.getAll('dbfiles');

  const rows = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tempPath = path.join(tmpdir(), `${uuidv4()}.db`);
    await fs.writeFile(tempPath, buffer);

    const db = new Database(tempPath);

    const stmt = db.prepare("SELECT ts, message FROM log WHERE action = 'start' ORDER BY ts ASC");
    const allLogs = stmt.all();

    let lastSongKey = '';

    for (let i = 0; i < allLogs.length; i++) {
      const row = allLogs[i];
      const isMusic = row.message.includes('\\Muzika\\');
      if (!isMusic) continue;

      const ts = new Date(row.ts);
      const fileName = row.message.split('\\').pop()?.replace('.mp3', '') || '';
      let performer = '', title = fileName;

      if (fileName.includes(' - ')) {
        [performer, title] = fileName.split(' - ');
        performer = performer.replace(/^[A-Za-z]?\s?\d{2,4}\s*/, '').trim();
      }

      let duration = '';
      if (i + 1 < allLogs.length) {
        const nextTs = new Date(allLogs[i + 1].ts);
        duration = Math.floor((nextTs - ts) / 1000);
      }

      // Preskoci ukoliko je pesma kraca od 20 sekundi
      if (!duration || duration < 20) continue;

      // Napravi songKey za svaku pesmu
      const songKey = `${performer.toLowerCase()} - ${title.toLowerCase()}`;

      // Preskoci ukoliko je ista pesma kao i prethodna
      if (songKey === lastSongKey) continue;
      lastSongKey = songKey; // Update lastSongKey

      rows.push({
        date: `${ts.getDate().toString().padStart(2, '0')}/${(ts.getMonth() + 1).toString().padStart(2, '0')}/${ts.getFullYear()}`,
        time: ts.toTimeString().split(' ')[0],
        performer,
        title: title.trim(),
        duration
      });
    }

    db.close();
    await fs.unlink(tempPath);
  }

  const zip = new JSZip();

  // === SOKOJ Excel ===
  const sokojWorkbook = new ExcelJS.Workbook();
  const sokojSheet = sokojWorkbook.addWorksheet('Sokoj RADIO kosuljica');
  sokojSheet.columns = [
    { header: 'Datum', key: 'date' },
    { header: 'Vreme emitovanja', key: 'time' },
    { header: 'Naziv emisije', key: 'empty1' },
    { header: 'Izvođač', key: 'performer' },
    { header: 'Naziv dela', key: 'title' },
    { header: 'Autor', key: 'empty2' },
    { header: 'Trajanje dela', key: 'duration' },
    { header: 'Način upotrebe dela (prazno, A ili K)', key: 'empty4' },
    { header: 'Napomena', key: 'empty5' },
  ];
  rows.forEach(r => sokojSheet.addRow({ ...r, empty1: '', empty2: '', empty4: '', empty5: '' }));
  const sokojBuffer = await sokojWorkbook.xlsx.writeBuffer();
  zip.file('sokoj.xlsx', sokojBuffer);

  // === OFPS Excel ===
  const ofpsWorkbook = new ExcelJS.Workbook();
  const ofpsSheet = ofpsWorkbook.addWorksheet('Fonogrami');

  // Heading tekst za OFPS
  ofpsSheet.mergeCells('A1:H1');
  ofpsSheet.getCell('A1').value = `Unos podataka o emitovanim fonogramima preko Excel-a\nOBRAZAC ZA PRIJAVU EMITOVANIH FONOGRAMA\nEMITER:`;

  // Header OFPS
  ofpsSheet.addRow([
    'Vreme emitovanja fonograma',
    'Datum',
    'Rezervna 1',
    'Ime interpretatora',
    'Naziv fonograma',
    'Trajanje fonograma (sekundi)',
    'Rezervna 2',
    'Napomene',
    'ISRC'
  ]);

  rows.forEach(r => {
    ofpsSheet.addRow([
      r.time,
      r.date.replaceAll('/', '.'),
      '',
      r.performer,
      r.title,
      r.duration,
      '', '', ''
    ]);
  });

  const ofpsBuffer = await ofpsWorkbook.xlsx.writeBuffer();
  zip.file('ofps.xlsx', ofpsBuffer);

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  return new Response(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="reports.zip"',
    },
  });
}
