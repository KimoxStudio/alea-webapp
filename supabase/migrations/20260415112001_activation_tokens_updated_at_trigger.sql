DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'activation_tokens_updated_at'
      AND tgrelid = 'public.activation_tokens'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER activation_tokens_updated_at
      BEFORE UPDATE ON public.activation_tokens
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END
$$;
