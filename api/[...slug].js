export default async (req, res) => {
  res.status(200).json({ message: 'Handler working', path: req.url, method: req.method });
};
