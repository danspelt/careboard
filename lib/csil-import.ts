export type ImportedTransaction = { postedOn: string; description: string; amount: number; externalId: string };

function date(value: string) { const match = value.match(/(\d{4})[-/]?(\d{2})[-/]?(\d{2})/); return match ? `${match[1]}-${match[2]}-${match[3]}` : ''; }

export function parseBankExport(text: string): ImportedTransaction[] {
  if (/<OFX[>\s]/i.test(text)) {
    return [...text.matchAll(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>)/gi)].map((match) => {
      const block = match[1]; const read = (tag: string) => block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'))?.[1]?.trim() ?? '';
      return { postedOn: date(read('DTPOSTED')), description: read('NAME') || read('MEMO'), amount: Number(read('TRNAMT')), externalId: read('FITID') };
    }).filter((row) => row.postedOn && row.description && Number.isFinite(row.amount));
  }
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean); if (lines.length < 2) return [];
  const split = (line: string) => line.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)?.map((cell) => cell.replace(/,$/, '').replace(/^"|"$/g, '').replaceAll('""', '"').trim()) ?? [];
  const headers = split(lines[0]).map((value) => value.toLowerCase());
  const index = (...names: string[]) => headers.findIndex((header) => names.some((name) => header.includes(name)));
  const di = index('date', 'posted'), ai = index('amount'), debit = index('debit'), credit = index('credit'), desc = index('description', 'memo', 'payee'), eid = index('id', 'reference');
  return lines.slice(1).map(split).map((cells) => ({ postedOn: date(cells[di] ?? ''), description: cells[desc] ?? '', amount: ai >= 0 ? Number((cells[ai] ?? '').replace(/[$,]/g, '')) : Number((cells[credit] || '0').replace(/[$,]/g, '')) - Number((cells[debit] || '0').replace(/[$,]/g, '')), externalId: eid >= 0 ? cells[eid] : '' })).filter((row) => row.postedOn && row.description && Number.isFinite(row.amount));
}

export function matchTransactions<T extends { id: string; expenseDate: string; amount: number }>(rows: ImportedTransaction[], expenses: T[]) {
  return rows.map((row) => ({ ...row, matchedExpenseId: expenses.find((expense) => expense.expenseDate === row.postedOn && Math.abs(Math.abs(row.amount) - expense.amount) < 0.005)?.id ?? null }));
}
