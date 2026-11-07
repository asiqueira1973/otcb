


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."otcb_papel" AS ENUM (
    'usuario',
    'admin'
);


ALTER TYPE "public"."otcb_papel" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_definir_atualizado_em"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."otcb_definir_atualizado_em"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_e_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
      from public.otcb_perfis p
     where p.id = (select auth.uid())
       and p.papel = 'admin'
  );
$$;


ALTER FUNCTION "public"."otcb_e_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_protege_papel"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.papel is distinct from old.papel
     and coalesce((select auth.role()), '') = 'authenticated'
     and not public.otcb_e_admin() then
    raise exception 'papel_protegido' using errcode = '42501';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."otcb_protege_papel"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."otcb_perfis" (
    "id" "uuid" NOT NULL,
    "apelido" "text" NOT NULL,
    "papel" "public"."otcb_papel" DEFAULT 'usuario'::"public"."otcb_papel" NOT NULL,
    "maioridade_confirmada_em" timestamp with time zone NOT NULL,
    "time_do_coracao" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "otcb_perfis_apelido_formato" CHECK (((("char_length"("apelido") >= 3) AND ("char_length"("apelido") <= 20)) AND ("apelido" ~ '^[A-Za-z0-9_.]+$'::"text")))
);


ALTER TABLE "public"."otcb_perfis" OWNER TO "postgres";


COMMENT ON TABLE "public"."otcb_perfis" IS 'Perfil do usuário anônimo do OTCB (spec 7.2). Data de nascimento nunca é gravada; só o instante da confirmação de maioridade (seção 6).';



ALTER TABLE ONLY "public"."otcb_perfis"
    ADD CONSTRAINT "otcb_perfis_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "otcb_perfis_apelido_unico" ON "public"."otcb_perfis" USING "btree" ("lower"("apelido"));



CREATE OR REPLACE TRIGGER "otcb_trg_atualizado_em" BEFORE UPDATE ON "public"."otcb_perfis" FOR EACH ROW EXECUTE FUNCTION "public"."otcb_definir_atualizado_em"();



CREATE OR REPLACE TRIGGER "otcb_trg_perfil_protege_papel" BEFORE UPDATE ON "public"."otcb_perfis" FOR EACH ROW EXECUTE FUNCTION "public"."otcb_protege_papel"();



ALTER TABLE ONLY "public"."otcb_perfis"
    ADD CONSTRAINT "otcb_perfis_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."otcb_perfis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otcb_perfis_admin_le_todos" ON "public"."otcb_perfis" FOR SELECT TO "authenticated" USING (( SELECT "public"."otcb_e_admin"() AS "otcb_e_admin"));



CREATE POLICY "otcb_perfis_atualiza_proprio" ON "public"."otcb_perfis" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "otcb_perfis_insere_proprio" ON "public"."otcb_perfis" FOR INSERT TO "authenticated" WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND ("papel" = 'usuario'::"public"."otcb_papel")));



CREATE POLICY "otcb_perfis_le_proprio" ON "public"."otcb_perfis" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."otcb_definir_atualizado_em"() TO "anon";
GRANT ALL ON FUNCTION "public"."otcb_definir_atualizado_em"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_definir_atualizado_em"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_e_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_e_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_e_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."otcb_protege_papel"() TO "anon";
GRANT ALL ON FUNCTION "public"."otcb_protege_papel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_protege_papel"() TO "service_role";



GRANT ALL ON TABLE "public"."otcb_perfis" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."otcb_perfis" TO "authenticated";



GRANT UPDATE("apelido") ON TABLE "public"."otcb_perfis" TO "authenticated";



GRANT UPDATE("papel") ON TABLE "public"."otcb_perfis" TO "authenticated";



GRANT UPDATE("time_do_coracao") ON TABLE "public"."otcb_perfis" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







