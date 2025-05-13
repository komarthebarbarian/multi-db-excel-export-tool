import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
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

    const stmt = db.prepare("SELECT ts, message, duration FROM log WHERE action = 'start' ORDER BY ts ASC");
    const allLogs = stmt.all();

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

      const duration = parseInt(row.duration);
      if (!duration || duration < 20) continue;

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
    { header: 'Način upotrebe dela (prazно, A ili K)', key: 'empty4' },
    { header: 'Napomena', key: 'empty5' },
  ];
  rows.forEach(r => sokojSheet.addRow({ ...r, empty1: '', empty2: '', empty4: '', empty5: '' }));
  const sokojBuffer = await sokojWorkbook.xlsx.writeBuffer();

  const ofpsWorkbook = new ExcelJS.Workbook();
  const ofpsSheet = ofpsWorkbook.addWorksheet('Fonogrami');

  ofpsSheet.mergeCells('A1:H1');
  ofpsSheet.getCell('A1').value = `Unos podataka o emitovanim fonogramima preko Excel-a\nOBRAZAC ZA PRIJAVU EMITOVANIH FONOGRAMA\nEMITER:`;

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

  const result = {
    sokoj: Buffer.from(sokojBuffer).toString('base64'),
    ofps: Buffer.from(await ofpsWorkbook.xlsx.writeBuffer()).toString('base64'),
  };

  return new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
}