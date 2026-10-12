-- Complément lot 2 : une version → idu, statut, aire, géométrie (en-tête + contour de la cible).
-- À rejouer après filiation_api.sql. Idempotent.

create or replace function filiation_api.version_info(p_insee text, p_version bigint)
returns jsonb
language sql stable security definer
set search_path = filiation, public, extensions
as $$
  select jsonb_build_object(
    'version_id', v.version_id,
    'idu',        v.idu,
    'section',    v.section,
    'numero',     v.numero,
    'valid_from', v.valid_from,
    'valid_to',   v.valid_to,
    'aire_m2',    round(st_area(v.geom)::numeric),
    'geojson',    st_asgeojson(st_transform(v.geom, 4326), 6)::jsonb)
  from filiation.parcelle_version v
  where v.version_id = p_version and v.code_insee = p_insee
$$;

revoke execute on function filiation_api.version_info(text, bigint) from public;
grant execute on function filiation_api.version_info(text, bigint) to filiation_api_exec;

-- Vérification :
--   select filiation_api.version_info('33234', filiation_api.version_actuelle('33234', '33234000AM2150')) - 'geojson';
