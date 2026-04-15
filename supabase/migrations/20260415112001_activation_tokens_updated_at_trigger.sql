CREATE TRIGGER activation_tokens_updated_at
  BEFORE UPDATE ON public.activation_tokens
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
