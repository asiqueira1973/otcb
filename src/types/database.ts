
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "otcb_bares": {
                  Row: {
                    "atualizado_em": string,"bairro": string,"classico": boolean,"coordenadas_atualizadas_em": string,"criado_em": string,"endereco": string,"excluido_em": string | null,"google_place_id": string | null,"id": string,"latitude": number,"longitude": number,"nome": string,"nota_colarinho_media": number | null,"nota_opinioes_media": number | null,"pontuacao_brahma": number,"qtd_fotos_avaliadas": number,"qtd_opinioes": number,"resumo_atualizado_em": string | null,"resumo_opinioes": string | null,"status": Database["public"]['Enums']["otcb_status_bar"],"status_atualizado_em": string,"tem_balcao": boolean | null,"transmite_jogos": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"bairro": string,"classico"?: boolean,"coordenadas_atualizadas_em"?: string,"criado_em"?: string,"endereco": string,"excluido_em"?: string | null,"google_place_id"?: string | null,"id"?: string,"latitude": number,"longitude": number,"nome": string,"nota_colarinho_media"?: number | null,"nota_opinioes_media"?: number | null,"pontuacao_brahma"?: number,"qtd_fotos_avaliadas"?: number,"qtd_opinioes"?: number,"resumo_atualizado_em"?: string | null,"resumo_opinioes"?: string | null,"status"?: Database["public"]['Enums']["otcb_status_bar"],"status_atualizado_em"?: string,"tem_balcao"?: boolean | null,"transmite_jogos"?: boolean | null
                  }
                  Update: {
                    "atualizado_em"?: string,"bairro"?: string,"classico"?: boolean,"coordenadas_atualizadas_em"?: string,"criado_em"?: string,"endereco"?: string,"excluido_em"?: string | null,"google_place_id"?: string | null,"id"?: string,"latitude"?: number,"longitude"?: number,"nome"?: string,"nota_colarinho_media"?: number | null,"nota_opinioes_media"?: number | null,"pontuacao_brahma"?: number,"qtd_fotos_avaliadas"?: number,"qtd_opinioes"?: number,"resumo_atualizado_em"?: string | null,"resumo_opinioes"?: string | null,"status"?: Database["public"]['Enums']["otcb_status_bar"],"status_atualizado_em"?: string,"tem_balcao"?: boolean | null,"transmite_jogos"?: boolean | null
                  }
                  Relationships: [
                    
                  ]
                },"otcb_carimbos": {
                  Row: {
                    "bar_id": string,"criado_em": string,"foto_id": string | null,"id": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bar_id": string,"criado_em"?: string,"foto_id"?: string | null,"id"?: string,"usuario_id": string
                  }
                  Update: {
                    "bar_id"?: string,"criado_em"?: string,"foto_id"?: string | null,"id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "otcb_carimbos_bar_id_fkey"
      columns: ["bar_id"]
isOneToOne: false
      referencedRelation: "otcb_bares"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "otcb_carimbos_foto_id_fkey"
      columns: ["foto_id"]
isOneToOne: false
      referencedRelation: "otcb_fotos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "otcb_carimbos_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "otcb_perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"otcb_compartilhamentos": {
                  Row: {
                    "criado_em": string,"id": string,"origem": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"id"?: string,"origem": string,"usuario_id": string
                  }
                  Update: {
                    "criado_em"?: string,"id"?: string,"origem"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "otcb_compartilhamentos_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "otcb_perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"otcb_denuncias": {
                  Row: {
                    "criado_em": string,"id": string,"motivo": string | null,"opiniao_id": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"id"?: string,"motivo"?: string | null,"opiniao_id": string,"usuario_id": string
                  }
                  Update: {
                    "criado_em"?: string,"id"?: string,"motivo"?: string | null,"opiniao_id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "otcb_denuncias_opiniao_id_fkey"
      columns: ["opiniao_id"]
isOneToOne: false
      referencedRelation: "otcb_opinioes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "otcb_denuncias_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "otcb_perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"otcb_evidencias": {
                  Row: {
                    "assunto": Database["public"]['Enums']["otcb_assunto_evidencia"],"bar_id": string,"criado_em": string,"data_evidencia": string,"foto_id": string | null,"id": string,"meia_vida_dias": number,"origem": Database["public"]['Enums']["otcb_origem_evidencia"],"peso": number,"sinal": Database["public"]['Enums']["otcb_sinal_evidencia"],"tipo": Database["public"]['Enums']["otcb_tipo_evidencia"],"trecho": string | null,"url_fonte": string | null,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assunto": Database["public"]['Enums']["otcb_assunto_evidencia"],"bar_id": string,"criado_em"?: string,"data_evidencia": string,"foto_id"?: string | null,"id"?: string,"meia_vida_dias": number,"origem": Database["public"]['Enums']["otcb_origem_evidencia"],"peso": number,"sinal": Database["public"]['Enums']["otcb_sinal_evidencia"],"tipo": Database["public"]['Enums']["otcb_tipo_evidencia"],"trecho"?: string | null,"url_fonte"?: string | null,"usuario_id"?: string | null
                  }
                  Update: {
                    "assunto"?: Database["public"]['Enums']["otcb_assunto_evidencia"],"bar_id"?: string,"criado_em"?: string,"data_evidencia"?: string,"foto_id"?: string | null,"id"?: string,"meia_vida_dias"?: number,"origem"?: Database["public"]['Enums']["otcb_origem_evidencia"],"peso"?: number,"sinal"?: Database["public"]['Enums']["otcb_sinal_evidencia"],"tipo"?: Database["public"]['Enums']["otcb_tipo_evidencia"],"trecho"?: string | null,"url_fonte"?: string | null,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "otcb_evidencias_bar_id_fkey"
      columns: ["bar_id"]
isOneToOne: false
      referencedRelation: "otcb_bares"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "otcb_evidencias_foto_id_fkey"
      columns: ["foto_id"]
isOneToOne: false
      referencedRelation: "otcb_fotos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "otcb_evidencias_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "otcb_perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"otcb_execucoes_garimpo": {
                  Row: {
                    "bares_novos": number,"chamadas_firecrawl": number,"chamadas_google": number,"concluido_em": string | null,"cursor": string | null,"erros": Json | null,"evidencias_criadas": number,"id": string,"iniciado_em": string,"status": Database["public"]['Enums']["otcb_status_execucao"],"tipo": Database["public"]['Enums']["otcb_tipo_execucao"]
                  }
                  ComputedFields: never
                  Insert: {
                    "bares_novos"?: number,"chamadas_firecrawl"?: number,"chamadas_google"?: number,"concluido_em"?: string | null,"cursor"?: string | null,"erros"?: Json | null,"evidencias_criadas"?: number,"id"?: string,"iniciado_em"?: string,"status"?: Database["public"]['Enums']["otcb_status_execucao"],"tipo": Database["public"]['Enums']["otcb_tipo_execucao"]
                  }
                  Update: {
                    "bares_novos"?: number,"chamadas_firecrawl"?: number,"chamadas_google"?: number,"concluido_em"?: string | null,"cursor"?: string | null,"erros"?: Json | null,"evidencias_criadas"?: number,"id"?: string,"iniciado_em"?: string,"status"?: Database["public"]['Enums']["otcb_status_execucao"],"tipo"?: Database["public"]['Enums']["otcb_tipo_execucao"]
                  }
                  Relationships: [
                    
                  ]
                },"otcb_fotos": {
                  Row: {
                    "bar_id": string | null,"caminho_storage": string,"comentario_ia": string | null,"criado_em": string,"distancia_bar_metros": number | null,"e_chopp": boolean,"excluido_em": string | null,"id": string,"modelo_ia": string,"nota_altura": number | null,"nota_colarinho": number | null,"nota_copo": number | null,"nota_cremosidade": number | null,"nota_gelado": number | null,"pessoa_identificavel": boolean | null,"usuario_confirmou_brahma": boolean,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bar_id"?: string | null,"caminho_storage": string,"comentario_ia"?: string | null,"criado_em"?: string,"distancia_bar_metros"?: number | null,"e_chopp": boolean,"excluido_em"?: string | null,"id"?: string,"modelo_ia": string,"nota_altura"?: number | null,"nota_colarinho"?: number | null,"nota_copo"?: number | null,"nota_cremosidade"?: number | null,"nota_gelado"?: number | null,"pessoa_identificavel"?: boolean | null,"usuario_confirmou_brahma": boolean,"usuario_id": string
                  }
                  Update: {
                    "bar_id"?: string | null,"caminho_storage"?: string,"comentario_ia"?: string | null,"criado_em"?: string,"distancia_bar_metros"?: number | null,"e_chopp"?: boolean,"excluido_em"?: string | null,"id"?: string,"modelo_ia"?: string,"nota_altura"?: number | null,"nota_colarinho"?: number | null,"nota_copo"?: number | null,"nota_cremosidade"?: number | null,"nota_gelado"?: number | null,"pessoa_identificavel"?: boolean | null,"usuario_confirmou_brahma"?: boolean,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "otcb_fotos_bar_id_fkey"
      columns: ["bar_id"]
isOneToOne: false
      referencedRelation: "otcb_bares"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "otcb_fotos_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "otcb_perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"otcb_jogos": {
                  Row: {
                    "atualizado_em": string,"competicao": string,"id": string,"id_externo": string,"inicio": string,"mandante": string,"visitante": string
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"competicao": string,"id"?: string,"id_externo": string,"inicio": string,"mandante": string,"visitante": string
                  }
                  Update: {
                    "atualizado_em"?: string,"competicao"?: string,"id"?: string,"id_externo"?: string,"inicio"?: string,"mandante"?: string,"visitante"?: string
                  }
                  Relationships: [
                    
                  ]
                },"otcb_mensagens": {
                  Row: {
                    "blocos": Json | null,"conteudo": string,"criado_em": string,"id": string,"papel": Database["public"]['Enums']["otcb_papel_mensagem"],"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocos"?: Json | null,"conteudo": string,"criado_em"?: string,"id"?: string,"papel": Database["public"]['Enums']["otcb_papel_mensagem"],"usuario_id": string
                  }
                  Update: {
                    "blocos"?: Json | null,"conteudo"?: string,"criado_em"?: string,"id"?: string,"papel"?: Database["public"]['Enums']["otcb_papel_mensagem"],"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "otcb_mensagens_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "otcb_perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"otcb_opinioes": {
                  Row: {
                    "atualizado_em": string,"bar_id": string,"criado_em": string,"edicoes_dia": string | null,"edicoes_qtd": number,"id": string,"motivo_ocultacao": string | null,"nota": number | null,"qtd_denuncias": number,"status": Database["public"]['Enums']["otcb_status_opiniao"],"texto": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"bar_id": string,"criado_em"?: string,"edicoes_dia"?: string | null,"edicoes_qtd"?: number,"id"?: string,"motivo_ocultacao"?: string | null,"nota"?: number | null,"qtd_denuncias"?: number,"status"?: Database["public"]['Enums']["otcb_status_opiniao"],"texto": string,"usuario_id": string
                  }
                  Update: {
                    "atualizado_em"?: string,"bar_id"?: string,"criado_em"?: string,"edicoes_dia"?: string | null,"edicoes_qtd"?: number,"id"?: string,"motivo_ocultacao"?: string | null,"nota"?: number | null,"qtd_denuncias"?: number,"status"?: Database["public"]['Enums']["otcb_status_opiniao"],"texto"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "otcb_opinioes_bar_id_fkey"
      columns: ["bar_id"]
isOneToOne: false
      referencedRelation: "otcb_bares"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "otcb_opinioes_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "otcb_perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"otcb_perfis": {
                  Row: {
                    "apelido": string,"atualizado_em": string,"criado_em": string,"id": string,"maioridade_confirmada_em": string,"papel": Database["public"]['Enums']["otcb_papel"],"revisao_menor_em": string | null,"time_do_coracao": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "apelido": string,"atualizado_em"?: string,"criado_em"?: string,"id": string,"maioridade_confirmada_em": string,"papel"?: Database["public"]['Enums']["otcb_papel"],"revisao_menor_em"?: string | null,"time_do_coracao"?: string | null
                  }
                  Update: {
                    "apelido"?: string,"atualizado_em"?: string,"criado_em"?: string,"id"?: string,"maioridade_confirmada_em"?: string,"papel"?: Database["public"]['Enums']["otcb_papel"],"revisao_menor_em"?: string | null,"time_do_coracao"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "otcb_agregados_confirmacao":
{ Args: { "p_bar_id": string }; Returns: {
              "confirmacoes_60_dias": number,"ultima_confirmacao_em": string
            }[]
                           },
"otcb_agregar_fotos_do_bar":
{ Args: { "p_bar_id": string }; Returns: undefined
                           },
"otcb_agregar_opinioes_do_bar":
{ Args: { "p_bar_id": string }; Returns: undefined
                           },
"otcb_anonimizar_evidencias":
{ Args: { "p_usuario": string }; Returns: number
                           },
"otcb_atualizar_coordenadas":
{ Args: { "p_bar_id": string,"p_latitude": number,"p_longitude": number }; Returns: undefined
                           },
"otcb_avisar_jogos_do_time":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"otcb_bar_mais_proximo":
{ Args: { "p_latitude": number,"p_longitude": number }; Returns: {
              "bar_id": string,"distancia_metros": number
            }[]
                           },
"otcb_bares_para_coordenadas":
{ Args: { "p_excluir"?: (string)[],"p_limite": number }; Returns: {
              "bar_id": string,"google_place_id": string
            }[]
                           },
"otcb_bares_para_resumo":
{ Args: { "p_excluir"?: (string)[],"p_limite": number }; Returns: {
              "bar_id": string,"nome": string
            }[]
                           },
"otcb_bares_para_revisita":
{ Args: { "p_excluir"?: (string)[],"p_limite": number }; Returns: {
              "bairro": string,"bar_id": string,"google_place_id": string,"nome": string,"urls": (string)[]
            }[]
                           },
"otcb_buscar_bares":
{ Args: { "p_bairro"?: string,"p_classico"?: boolean,"p_latitude"?: number,"p_longitude"?: number,"p_raio_metros"?: number,"p_tem_balcao"?: boolean,"p_texto"?: string,"p_transmite_jogos"?: boolean }; Returns: {
              "bairro": string,"bar_id": string,"classico": boolean,"confirmacoes_60_dias": number,"distancia_metros": number,"endereco": string,"latitude": number,"longitude": number,"nome": string,"nota_colarinho_media": number,"nota_opinioes_media": number,"qtd_opinioes": number,"resumo_opinioes": string,"status": Database["public"]['Enums']["otcb_status_bar"],"tem_balcao": boolean,"transmite_jogos": boolean,"ultima_confirmacao_em": string
            }[]
                           },
"otcb_casar_bar":
{ Args: { "p_latitude": number,"p_longitude": number,"p_nome": string }; Returns: string
                           },
"otcb_casar_ou_criar_bar":
{ Args: { "p_bairro": string,"p_criar": boolean,"p_endereco": string,"p_latitude": number,"p_longitude": number,"p_nome": string,"p_place_id": string }; Returns: Json
                           },
"otcb_checar_edicao":
{ Args: { "p_bar_id": string,"p_usuario": string }; Returns: boolean
                           },
"otcb_configurar_garimpo":
{ Args: { "p_segredo": string,"p_url_funcoes": string }; Returns: undefined
                           },
"otcb_confirmar_bar":
{ Args: { "p_assunto": Database["public"]['Enums']["otcb_assunto_evidencia"],"p_bar_id": string,"p_sinal": Database["public"]['Enums']["otcb_sinal_evidencia"] }; Returns: Json
                           },
"otcb_contexto_chat":
{ Args: { "p_usuario": string }; Returns: {
              "conteudo": string,"criado_em": string,"papel": Database["public"]['Enums']["otcb_papel_mensagem"]
            }[]
                           },
"otcb_detalhes_bar":
{ Args: { "p_bar_id": string }; Returns: Json
                           },
"otcb_dia_sp":
{ Args: { "p_instante": string }; Returns: string
                           },
"otcb_distancia_metros":
{ Args: { "lat1": number,"lat2": number,"lng1": number,"lng2": number }; Returns: number
                           },
"otcb_e_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"otcb_fotos_hoje":
{ Args: { "p_usuario": string }; Returns: number
                           },
"otcb_garimpo_disparar":
{ Args: { "p_execucao_id"?: string,"p_modo": string }; Returns: number
                           },
"otcb_garimpo_iniciar":
{ Args: { "p_tipo": Database["public"]['Enums']["otcb_tipo_execucao"] }; Returns: string
                           },
"otcb_garimpo_uso_mes":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"otcb_gravar_resumo":
{ Args: { "p_bar_id": string,"p_resumo": string }; Returns: boolean
                           },
"otcb_hoje_sp":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"otcb_inserir_confirmacao":
{ Args: { "p_assunto": Database["public"]['Enums']["otcb_assunto_evidencia"],"p_bar_id": string,"p_sinal": Database["public"]['Enums']["otcb_sinal_evidencia"],"p_usuario": string }; Returns: undefined
                           },
"otcb_jogos_disparar":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"otcb_jogos_gravar":
{ Args: { "p_dados": Json }; Returns: Json
                           },
"otcb_ligar_foto_recente":
{ Args: { "p_bar": string,"p_usuario": string }; Returns: undefined
                           },
"otcb_limpeza_diaria":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"otcb_marcar_revisao_menor":
{ Args: { "p_usuario": string }; Returns: undefined
                           },
"otcb_mensagens_hoje":
{ Args: { "p_usuario": string }; Returns: number
                           },
"otcb_meu_passaporte":
{ Args: { "p_versao"?: number }; Returns: Json
                           },
"otcb_normalizar":
{ Args: { "p_texto": string }; Returns: string
                           },
"otcb_opinioes_do_bar":
{ Args: { "p_bar_id": string,"p_pagina"?: number }; Returns: {
              "apelido": string,"criado_em": string,"nota": number,"opiniao_id": string,"texto": string
            }[]
                           },
"otcb_recalcular_bar":
{ Args: { "p_bar_id": string }; Returns: Database["public"]['Enums']["otcb_status_bar"]
                           },
"otcb_recalcular_todos":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"otcb_recusar_edicao":
{ Args: { "p_bar_id": string,"p_usuario": string }; Returns: boolean
                           },
"otcb_registrar_card":
{ Args: { "p_bar_id": string,"p_resultado": string,"p_tipo": string }; Returns: string
                           },
"otcb_registrar_compartilhamento":
{ Args: { "p_origem": string }; Returns: Json
                           },
"otcb_registrar_evidencia_garimpo":
{ Args: { "p_assunto": Database["public"]['Enums']["otcb_assunto_evidencia"],"p_bar_id": string,"p_data_evidencia": string,"p_sinal": Database["public"]['Enums']["otcb_sinal_evidencia"],"p_tipo": Database["public"]['Enums']["otcb_tipo_evidencia"],"p_trecho": string,"p_url_fonte": string }; Returns: string
                           },
"otcb_regra_evidencia":
{ Args: { "p_assunto": Database["public"]['Enums']["otcb_assunto_evidencia"],"p_sinal": Database["public"]['Enums']["otcb_sinal_evidencia"],"p_tipo": Database["public"]['Enums']["otcb_tipo_evidencia"] }; Returns: Record<string, unknown>
                           },
"otcb_resultado_foto":
{ Args: { "p_foto_id": string }; Returns: Json
                           },
"otcb_salvar_opiniao":
{ Args: { "p_bar_id": string,"p_nota": number,"p_texto": string,"p_usuario": string }; Returns: string
                           },
"otcb_sugerir_bar":
{ Args: { "p_bairro": string,"p_endereco": string,"p_latitude": number,"p_longitude": number,"p_no_bar"?: boolean,"p_nome": string,"p_tem_brahma": boolean }; Returns: Json
                           },
"otcb_time_canonico":
{ Args: { "p_nome": string }; Returns: string
                           },
"otcb_usuario_atual":
{ Args: Record<PropertyKey, never>; Returns: string
                           }
          }
          Enums: {
            "otcb_assunto_evidencia": "tem_brahma"|"transmite_jogos"|"funcionamento","otcb_origem_evidencia": "usuario"|"garimpo"|"seed","otcb_papel": "usuario"|"admin","otcb_papel_mensagem": "usuario"|"assistente"|"sistema","otcb_sinal_evidencia": "positivo"|"negativo"|"fechado","otcb_status_bar": "confirmado"|"provavel"|"incerto"|"sem_brahma"|"fechado","otcb_status_execucao": "em_andamento"|"concluida"|"falhou","otcb_status_opiniao": "publicada"|"oculta_moderacao"|"oculta_denuncias"|"oculta_admin","otcb_tipo_evidencia": "foto_colarinhometro"|"confirmacao_usuario"|"sugestao_usuario"|"cardapio_site"|"pagina_web"|"avaliacao_google"|"status_google"|"seed_otcb_antigo"|"curadoria"|"sugestao_no_bar"|"sugestao_sem_certeza","otcb_tipo_execucao": "descoberta"|"revisita"|"coordenadas"|"resumos"|"jogos"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "otcb_assunto_evidencia": ["tem_brahma", "transmite_jogos", "funcionamento"],"otcb_origem_evidencia": ["usuario", "garimpo", "seed"],"otcb_papel": ["usuario", "admin"],"otcb_papel_mensagem": ["usuario", "assistente", "sistema"],"otcb_sinal_evidencia": ["positivo", "negativo", "fechado"],"otcb_status_bar": ["confirmado", "provavel", "incerto", "sem_brahma", "fechado"],"otcb_status_execucao": ["em_andamento", "concluida", "falhou"],"otcb_status_opiniao": ["publicada", "oculta_moderacao", "oculta_denuncias", "oculta_admin"],"otcb_tipo_evidencia": ["foto_colarinhometro", "confirmacao_usuario", "sugestao_usuario", "cardapio_site", "pagina_web", "avaliacao_google", "status_google", "seed_otcb_antigo", "curadoria", "sugestao_no_bar", "sugestao_sem_certeza"],"otcb_tipo_execucao": ["descoberta", "revisita", "coordenadas", "resumos", "jogos"]
          }
        }
} as const
