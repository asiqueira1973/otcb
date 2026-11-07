-- Épico 8.2 — modelo de dados das seções 7.1 e 7.2 (otcb_perfis já existe desde o 8.1).
-- Banco compartilhado: todo objeto leva o prefixo otcb_. RLS ligado em todas as tabelas (seção 6);
-- as políticas da 6.1 ficam na migration seguinte.

-- ===== Enums (seção 7.1, valores na ordem do spec) =====
create type public.otcb_status_bar as enum ('confirmado', 'provavel', 'incerto', 'sem_brahma', 'fechado');
create type public.otcb_assunto_evidencia as enum ('tem_brahma', 'transmite_jogos', 'funcionamento');
create type public.otcb_sinal_evidencia as enum ('positivo', 'negativo', 'fechado');
create type public.otcb_tipo_evidencia as enum (
  'foto_colarinhometro', 'confirmacao_usuario', 'sugestao_usuario', 'cardapio_site',
  'pagina_web', 'avaliacao_google', 'status_google', 'seed_otcb_antigo'
);
create type public.otcb_origem_evidencia as enum ('usuario', 'garimpo', 'seed');
create type public.otcb_status_opiniao as enum ('publicada', 'oculta_moderacao', 'oculta_denuncias', 'oculta_admin');
create type public.otcb_papel_mensagem as enum ('usuario', 'assistente', 'sistema');
create type public.otcb_tipo_execucao as enum ('descoberta', 'revisita', 'coordenadas', 'resumos', 'jogos');
create type public.otcb_status_execucao as enum ('em_andamento', 'concluida', 'falhou');

-- ===== otcb_bares (7.2): cada bar conhecido. status, pontuação e agregados são calculados (11.1–11.5, 11.8) =====
create table public.otcb_bares (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  endereco text not null,
  bairro text not null,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  coordenadas_atualizadas_em timestamptz not null default now(),
  google_place_id text,
  status public.otcb_status_bar not null default 'incerto',
  pontuacao_brahma numeric(6,3) not null default 0,
  status_atualizado_em timestamptz not null default now(),
  transmite_jogos boolean,
  tem_balcao boolean,
  classico boolean not null default false,
  nota_colarinho_media numeric(4,2),
  qtd_fotos_avaliadas integer not null default 0,
  nota_opinioes_media numeric(3,2),
  qtd_opinioes integer not null default 0,
  resumo_opinioes text,
  resumo_atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint otcb_bares_google_place_id_unico unique (google_place_id)
);
create index otcb_bares_status_idx on public.otcb_bares (status);
create index otcb_bares_bairro_idx on public.otcb_bares (bairro);
create index otcb_bares_lat_lng_idx on public.otcb_bares (latitude, longitude);

-- ===== otcb_fotos (7.2): cada foto do Colarinhômetro; caminho {usuario_id}/{id}.jpg no bucket otcb-fotos =====
create table public.otcb_fotos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.otcb_perfis (id) on delete cascade,
  bar_id uuid references public.otcb_bares (id),
  distancia_bar_metros integer,
  caminho_storage text not null,
  e_chopp boolean not null,
  usuario_confirmou_brahma boolean not null,
  nota_altura numeric(3,1),
  nota_cremosidade numeric(3,1),
  nota_copo numeric(3,1),
  nota_gelado numeric(3,1),
  nota_colarinho numeric(3,1),
  comentario_ia text,
  modelo_ia text not null,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  -- Seção 7.2: notas de 0 a 10; distância só existe quando há bar.
  constraint otcb_fotos_notas_faixa check (
    coalesce(nota_altura, 0) between 0 and 10 and coalesce(nota_cremosidade, 0) between 0 and 10
    and coalesce(nota_copo, 0) between 0 and 10 and coalesce(nota_gelado, 0) between 0 and 10
    and coalesce(nota_colarinho, 0) between 0 and 10
  ),
  constraint otcb_fotos_distancia_com_bar check (bar_id is not null or distancia_bar_metros is null),
  -- Seção 6.1 / 18 (pegadinha de caminho): o arquivo fica na pasta do dono.
  constraint otcb_fotos_caminho_do_dono check (caminho_storage like usuario_id::text || '/%')
);
create index otcb_fotos_usuario_idx on public.otcb_fotos (usuario_id, criado_em desc);
create index otcb_fotos_bar_idx on public.otcb_fotos (bar_id);

-- ===== otcb_evidencias (7.2): tudo que indica se o bar tem Brahma, passa jogo ou está aberto =====
create table public.otcb_evidencias (
  id uuid primary key default gen_random_uuid(),
  bar_id uuid not null references public.otcb_bares (id),
  assunto public.otcb_assunto_evidencia not null,
  sinal public.otcb_sinal_evidencia not null,
  tipo public.otcb_tipo_evidencia not null,
  origem public.otcb_origem_evidencia not null,
  usuario_id uuid references public.otcb_perfis (id) on delete set null,
  foto_id uuid references public.otcb_fotos (id) on delete set null,
  url_fonte text,
  trecho text,
  data_evidencia timestamptz not null,
  peso numeric(4,2) not null,
  meia_vida_dias integer not null,
  criado_em timestamptz not null default now(),
  -- 7.2: sinal 'fechado' só com assunto 'funcionamento'; trecho até 300 caracteres (11.10).
  constraint otcb_evidencias_fechado_so_funcionamento check (sinal <> 'fechado' or assunto = 'funcionamento'),
  constraint otcb_evidencias_trecho_tamanho check (trecho is null or char_length(trecho) <= 300)
);
create unique index otcb_evidencias_fonte_unica on public.otcb_evidencias (bar_id, assunto, url_fonte)
  where url_fonte is not null;
create index otcb_evidencias_bar_assunto_idx on public.otcb_evidencias (bar_id, assunto);
create index otcb_evidencias_usuario_idx on public.otcb_evidencias (usuario_id, criado_em) where usuario_id is not null;
create index otcb_evidencias_foto_idx on public.otcb_evidencias (foto_id) where foto_id is not null;

-- ===== otcb_carimbos (7.2): Passaporte; 1 por usuário por bar =====
create table public.otcb_carimbos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.otcb_perfis (id) on delete cascade,
  bar_id uuid not null references public.otcb_bares (id),
  foto_id uuid references public.otcb_fotos (id) on delete set null,
  criado_em timestamptz not null default now(),
  constraint otcb_carimbos_usuario_bar_unico unique (usuario_id, bar_id)
);
create index otcb_carimbos_bar_idx on public.otcb_carimbos (bar_id);
create index otcb_carimbos_foto_idx on public.otcb_carimbos (foto_id) where foto_id is not null;

-- ===== otcb_opinioes (7.2; regra 11.7) =====
create table public.otcb_opinioes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.otcb_perfis (id) on delete cascade,
  bar_id uuid not null references public.otcb_bares (id),
  texto text not null,
  nota smallint,
  status public.otcb_status_opiniao not null default 'publicada',
  motivo_ocultacao text,
  qtd_denuncias integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint otcb_opinioes_usuario_bar_unico unique (usuario_id, bar_id),
  constraint otcb_opinioes_texto_tamanho check (char_length(texto) between 10 and 500),
  constraint otcb_opinioes_nota_faixa check (nota is null or nota between 1 and 5)
);
create index otcb_opinioes_bar_status_idx on public.otcb_opinioes (bar_id, status);

-- ===== otcb_denuncias (7.2; regra 11.7) =====
create table public.otcb_denuncias (
  id uuid primary key default gen_random_uuid(),
  opiniao_id uuid not null references public.otcb_opinioes (id) on delete cascade,
  usuario_id uuid not null references public.otcb_perfis (id) on delete cascade,
  motivo text,
  criado_em timestamptz not null default now(),
  constraint otcb_denuncias_opiniao_usuario_unico unique (opiniao_id, usuario_id)
);
create index otcb_denuncias_usuario_idx on public.otcb_denuncias (usuario_id);

-- ===== otcb_mensagens (7.2): histórico do chat, retenção de 30 dias (11.14) =====
create table public.otcb_mensagens (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.otcb_perfis (id) on delete cascade,
  papel public.otcb_papel_mensagem not null,
  conteudo text not null,
  blocos jsonb,
  criado_em timestamptz not null default now()
);
create index otcb_mensagens_usuario_criado_idx on public.otcb_mensagens (usuario_id, criado_em desc);

-- ===== otcb_jogos (7.2): jogos do dia; apagados 2 dias após o início (11.14) =====
create table public.otcb_jogos (
  id uuid primary key default gen_random_uuid(),
  id_externo text not null,
  competicao text not null,
  mandante text not null,
  visitante text not null,
  inicio timestamptz not null,
  atualizado_em timestamptz not null default now(),
  constraint otcb_jogos_id_externo_unico unique (id_externo)
);
create index otcb_jogos_inicio_idx on public.otcb_jogos (inicio);

-- ===== otcb_execucoes_garimpo (7.2): registro de cada execução do garimpo =====
create table public.otcb_execucoes_garimpo (
  id uuid primary key default gen_random_uuid(),
  tipo public.otcb_tipo_execucao not null,
  status public.otcb_status_execucao not null default 'em_andamento',
  cursor text,
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  bares_novos integer not null default 0,
  evidencias_criadas integer not null default 0,
  chamadas_google integer not null default 0,
  chamadas_firecrawl integer not null default 0,
  erros jsonb
);

-- ===== atualizado_em (trigger otcb_trg_atualizado_em da 7.5, função do 8.1) =====
create trigger otcb_trg_atualizado_em before update on public.otcb_bares
  for each row execute function public.otcb_definir_atualizado_em();
create trigger otcb_trg_atualizado_em before update on public.otcb_opinioes
  for each row execute function public.otcb_definir_atualizado_em();
create trigger otcb_trg_atualizado_em before update on public.otcb_jogos
  for each row execute function public.otcb_definir_atualizado_em();

-- ===== RLS (seção 6): ligado em todas as tabelas otcb_ =====
alter table public.otcb_bares enable row level security;
alter table public.otcb_evidencias enable row level security;
alter table public.otcb_fotos enable row level security;
alter table public.otcb_carimbos enable row level security;
alter table public.otcb_opinioes enable row level security;
alter table public.otcb_denuncias enable row level security;
alter table public.otcb_mensagens enable row level security;
alter table public.otcb_jogos enable row level security;
alter table public.otcb_execucoes_garimpo enable row level security;

-- ===== Grants (seções 5.2 e 6.1). anon nunca acessa; o RLS restringe as linhas. =====
revoke all on public.otcb_bares, public.otcb_evidencias, public.otcb_fotos, public.otcb_carimbos,
  public.otcb_opinioes, public.otcb_denuncias, public.otcb_mensagens, public.otcb_jogos,
  public.otcb_execucoes_garimpo from anon, authenticated;

-- Bares: todos leem; escrita só admin (política otcb_bares_admin_tudo) — base para um painel futuro (5.1).
grant select, insert, update, delete on public.otcb_bares to authenticated;
-- Evidências: só admin lê (RLS); usuários escrevem só via otcb_confirmar_bar / otcb_sugerir_bar.
grant select on public.otcb_evidencias to authenticated;
-- Fotos: leitura própria/admin; o único update do cliente é o soft delete (excluido_em).
grant select on public.otcb_fotos to authenticated;
grant update (excluido_em) on public.otcb_fotos to authenticated;
-- Carimbos: só leitura (nascem por trigger).
grant select on public.otcb_carimbos to authenticated;
-- Opiniões: leitura; delete da própria; update/delete pelo admin (ocultar/reexibir, otcb_opinioes_admin_tudo).
grant select, delete on public.otcb_opinioes to authenticated;
grant update (status, motivo_ocultacao) on public.otcb_opinioes to authenticated;
-- Denúncias: o usuário insere a própria; admin lê.
grant select on public.otcb_denuncias to authenticated;
grant insert (opiniao_id, usuario_id, motivo) on public.otcb_denuncias to authenticated;
-- Mensagens: leitura e delete das próprias (insert só serviço).
grant select, delete on public.otcb_mensagens to authenticated;
-- Jogos: leitura. Execuções: só admin lê (RLS).
grant select on public.otcb_jogos to authenticated;
grant select on public.otcb_execucoes_garimpo to authenticated;
