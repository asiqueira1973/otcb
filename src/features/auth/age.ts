// Cálculo de maioridade do onboarding (spec seção 6 e épico 8.1).
// A data de nascimento só existe na memória da tela: nunca é enviada, gravada nem logada (seção 20).

export type CivilDate = { year: number; month: number; day: number };

// Lê "DD/MM/AAAA" digitado pelo usuário.
// Recebe: o texto. Devolve: a data civil, ou null se o texto não for uma data real (ex.: 31/02).
export function parseBirthDate(text: string): CivilDate | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1900 || month < 1 || month > 12 || day < 1) return null;
  if (day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

// Devolve o dia civil de hoje em America/Sao_Paulo (regra 11.12), a partir de um instante.
// Recebe: o instante (padrão: agora). Devolve: { year, month, day } no fuso de São Paulo.
export function todayInSaoPaulo(now: Date = new Date()): CivilDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

// Idade civil completa em anos na data "hoje".
// Recebe: nascimento e hoje (datas civis). Devolve: anos completos (pode ser negativo para data futura).
// Quem nasceu em 29/02 completa anos em 01/03 nos anos não bissextos (contagem civil).
export function ageInYears(birth: CivilDate, today: CivilDate): number {
  let age = today.year - birth.year;
  const birthdayMonth = birth.month === 2 && birth.day === 29 && !isLeap(today.year) ? 3 : birth.month;
  const birthdayDay = birth.month === 2 && birth.day === 29 && !isLeap(today.year) ? 1 : birth.day;
  if (today.month < birthdayMonth || (today.month === birthdayMonth && today.day < birthdayDay)) age -= 1;
  return age;
}

// Implementa o critério do 8.1: 18 anos exatos no dia libera; 17 anos e 364 dias bloqueia.
// Recebe: nascimento e hoje. Devolve: true se tem 18 anos ou mais.
export function isAdult(birth: CivilDate, today: CivilDate): boolean {
  return ageInYears(birth, today) >= 18;
}

// Data de nascimento depois de hoje é inválida (não é idade).
// Recebe: nascimento e hoje. Devolve: true se o nascimento é posterior a hoje.
export function isFuture(birth: CivilDate, today: CivilDate): boolean {
  return (
    birth.year > today.year ||
    (birth.year === today.year &&
      (birth.month > today.month || (birth.month === today.month && birth.day > today.day)))
  );
}

// Aplica a máscara DD/MM/AAAA enquanto o usuário digita (só dígitos, barras automáticas).
// Recebe: o texto digitado. Devolve: o texto mascarado, com no máximo 8 dígitos.
export function maskBirthDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
