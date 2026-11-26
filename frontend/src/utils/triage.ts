/**
 * Condições que são emergência médica: o guia "Qual serviço de saúde devo procurar?"
 * NÃO pode sugerir autocuidado nelas e deve mostrar o 192 (SAMU) primeiro.
 *
 * ATENÇÃO: lista inicial conservadora, a ser validada/ampliada com a revisão clínica do squad.
 * Para incluir outra doença, basta acrescentar o prefixo do CID-10 ou uma palavra do nome.
 */
const EMERGENCY_CID10_PREFIXES = [
  'I21', // infarto agudo do miocárdio
  'I22', // infarto subsequente
  'I46', // parada cardíaca
  'I60', // hemorragia subaracnóide
  'I61', // hemorragia intracerebral
  'I62', // outras hemorragias intracranianas
  'I63', // infarto cerebral (AVC isquêmico)
  'I64', // AVC não especificado
  'J96', // insuficiência respiratória
  'R57', // choque
  'T78.2', // choque anafilático
] as const;

const EMERGENCY_NAME_KEYWORDS = [
  'avc',
  'acidente vascular',
  'derrame',
  'infarto',
  'parada cardiaca',
  'anafilaxia',
  'choque anafilatico',
] as const;

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function isEmergencyCondition(cond: {
  cid10_code?: string;
  popular_name: string;
  id: string;
}): boolean {
  const cid = (cond.cid10_code ?? '').trim().toUpperCase();
  if (cid && EMERGENCY_CID10_PREFIXES.some((prefix) => cid.startsWith(prefix))) {
    return true;
  }
  const haystack = ` ${normalize(cond.popular_name)} ${normalize(cond.id).replace(/-/g, ' ')} `;
  return EMERGENCY_NAME_KEYWORDS.some(
    (kw) => haystack.includes(` ${kw} `) || haystack.includes(kw + ' '),
  );
}
