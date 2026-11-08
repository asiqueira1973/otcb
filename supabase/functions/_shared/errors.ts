// Erros tipados dos serviços externos do garimpo (seção 12.5).

// Erro de um serviço externo. `fatal` = não adianta continuar a execução (chave inválida, sem crédito):
// a execução termina como 'falhou' (12.3). Os demais são falha do item e o lote segue (critério 5 do 8.3).
export class ExternalServiceError extends Error {
  constructor(
    readonly service: "google" | "firecrawl" | "claude",
    readonly status: number,
    readonly fatal: boolean,
    message: string,
  ) {
    super(`${service}_${status}: ${message}`);
    this.name = "ExternalServiceError";
  }
}

// Status HTTP que indicam problema de credencial ou de conta (não do item): 401, 402 e 403.
export function isFatalStatus(status: number): boolean {
  return status === 401 || status === 402 || status === 403;
}
