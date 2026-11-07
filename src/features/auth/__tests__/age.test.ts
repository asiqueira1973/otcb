import { ageInYears, isAdult, isFuture, maskBirthDate, parseBirthDate, todayInSaoPaulo } from '../age';

// Testes do critério de maioridade do épico 8.1 (seção 6) e do fuso da regra 11.12.
describe('maioridade', () => {
  const today = { year: 2026, month: 11, day: 7 };

  it('17 anos e 364 dias bloqueia', () => {
    // Faz 18 amanhã (08/11/2008).
    expect(isAdult({ year: 2008, month: 11, day: 8 }, today)).toBe(false);
  });

  it('18 anos exatos no dia libera', () => {
    expect(isAdult({ year: 2008, month: 11, day: 7 }, today)).toBe(true);
  });

  it('nascido em 29/02 faz 18 em 01/03 de ano não bissexto', () => {
    const birth = { year: 2008, month: 2, day: 29 };
    expect(isAdult(birth, { year: 2026, month: 2, day: 28 })).toBe(false);
    expect(isAdult(birth, { year: 2026, month: 3, day: 1 })).toBe(true);
  });

  it('nascido em 29/02 faz anos em 29/02 em ano bissexto', () => {
    expect(ageInYears({ year: 2010, month: 2, day: 29 }, { year: 2028, month: 2, day: 29 })).toBe(18);
    expect(ageInYears({ year: 2010, month: 2, day: 29 }, { year: 2028, month: 2, day: 28 })).toBe(17);
  });

  it('data futura é detectada', () => {
    expect(isFuture({ year: 2026, month: 11, day: 8 }, today)).toBe(true);
    expect(isFuture({ year: 2026, month: 11, day: 7 }, today)).toBe(false);
  });
});

describe('parseBirthDate', () => {
  it('aceita data real em DD/MM/AAAA', () => {
    expect(parseBirthDate('07/11/1990')).toEqual({ year: 1990, month: 11, day: 7 });
    expect(parseBirthDate('29/02/2000')).toEqual({ year: 2000, month: 2, day: 29 });
  });

  it.each(['31/02/1990', '29/02/2001', '00/01/1990', '15/13/1990', '1/1/1990', '', 'abc', '01/01/1800'])(
    'recusa %p',
    (text) => {
      expect(parseBirthDate(text)).toBeNull();
    },
  );
});

describe('todayInSaoPaulo (regra 11.12)', () => {
  it('23h30 de SP ainda é o mesmo dia, embora já seja o dia seguinte em UTC', () => {
    // 2026-11-08T02:30Z = 07/11/2026 23:30 em São Paulo (UTC-3).
    expect(todayInSaoPaulo(new Date('2026-11-08T02:30:00Z'))).toEqual({ year: 2026, month: 11, day: 7 });
  });

  it('meia-noite de SP já é o dia seguinte', () => {
    expect(todayInSaoPaulo(new Date('2026-11-08T03:00:00Z'))).toEqual({ year: 2026, month: 11, day: 8 });
  });
});

describe('maskBirthDate', () => {
  it('insere as barras e ignora não dígitos', () => {
    expect(maskBirthDate('0711')).toBe('07/11');
    expect(maskBirthDate('07111990')).toBe('07/11/1990');
    expect(maskBirthDate('07a11b1990123')).toBe('07/11/1990');
  });
});
