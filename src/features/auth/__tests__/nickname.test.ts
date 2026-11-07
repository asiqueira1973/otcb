import { nicknameErrorFromDb, validateNickname } from '../nickname';

// Testes da regra 11.7 (apelido) no app, espelhando o CHECK do banco.
describe('validateNickname', () => {
  it.each(['abc', 'Fulano_10', 'a.b_c', 'abcdefghij_klmnop.qr'])('aceita %p', (value) => {
    expect(validateNickname(value)).toBeNull();
  });

  it.each(['ab', 'abcdefghijklmnopqrstu', 'joão', 'com espaço', 'emoji🍺', 'hífen-no'])('recusa %p', (value) => {
    expect(validateNickname(value)).toBe('formato');
  });
});

describe('nicknameErrorFromDb', () => {
  it('23505 (índice único em lower(apelido)) vira em_uso', () => {
    expect(nicknameErrorFromDb('23505')).toBe('em_uso');
  });
  it('23514 (CHECK) vira formato', () => {
    expect(nicknameErrorFromDb('23514')).toBe('formato');
  });
  it('outros erros não são de apelido', () => {
    expect(nicknameErrorFromDb('PGRST301')).toBeNull();
    expect(nicknameErrorFromDb(undefined)).toBeNull();
  });
});
