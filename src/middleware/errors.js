export function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;
  if (status >= 500) console.error('Falha interna:', error.message);
  res.status(status).json({
    error: {
      message:
        status >= 500
          ? 'Não foi possível concluir. Tente novamente mais tarde.'
          : error.type === 'entity.too.large'
            ? 'Arquivo ou dados maiores que o limite permitido.'
            : error.type === 'entity.parse.failed'
              ? 'JSON inválido.'
              : error.message,
    },
  });
}
