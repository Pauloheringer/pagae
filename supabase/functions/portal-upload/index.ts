// Upload de arquivos pelo cliente no portal (comprovante, documentos), sem
// login do Supabase: a sessão assinada do portal autoriza o envio, e o arquivo
// fica numa pasta só daquele cliente.
import { serve, json, serviceClient, HttpError } from '../_shared/http.ts';
import { verifySession } from '../_shared/portalSession.ts';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

serve(async (req) => {
  const form = await req.formData();
  const customerId = await verifySession(form.get('session'));
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Arquivo não enviado');
  if (file.size > MAX_BYTES) throw new HttpError(400, 'Arquivo maior que 10 MB');
  if (!ALLOWED.test(file.type)) throw new HttpError(400, 'Envie uma imagem ou PDF');

  const safe = (file.name || 'arquivo').normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);
  const path = `portal/${customerId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await serviceClient().storage.from('private-files').upload(path, file, { contentType: file.type });
  if (error) throw new HttpError(500, error.message);
  return json({ file_uri: `private-files/${path}` });
});
