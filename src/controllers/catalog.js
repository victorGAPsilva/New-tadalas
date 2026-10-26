export function catalogController(catalog) {
  return {
    products: async (_req, res) => res.json({ data: await catalog.products() }),
    categories: async (_req, res) =>
      res.json({ data: await catalog.categories() }),
    config: async (_req, res) => res.json({ data: await catalog.config() }),
    product: async (req, res) => {
      const product = (await catalog.products()).find(
        (p) => p.id === req.params.id,
      );
      if (!product)
        return res
          .status(404)
          .json({ error: { message: 'Produto não encontrado.' } });
      res.json({ data: product });
    },
  };
}
