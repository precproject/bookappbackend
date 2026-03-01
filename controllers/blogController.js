const Blog = require('../models/Blog');

// @route   GET /api/blogs
exports.getBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search, adminView } = req.query;
    let query = {};

    // Public view only sees published articles
    if (adminView !== 'true') query.isPublished = true;
    if (category && category !== 'All') query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const totalItems = await Blog.countDocuments(query);
    const blogs = await Blog.find(query).sort({ publishedAt: -1 }).skip(skip).limit(Number(limit));

    res.status(200).json({ blogs, totalItems, totalPages: Math.ceil(totalItems / Number(limit)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/blogs/:slug
exports.getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug });
    if (!blog) return res.status(404).json({ message: 'Article not found' });
    res.status(200).json(blog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   POST /api/admin/blogs
exports.createBlog = async (req, res) => {
  try {
    const blog = await Blog.create(req.body);
    res.status(201).json(blog);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Title/Slug already exists.' });
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/blogs/:id
exports.updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.status(200).json(blog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   DELETE /api/admin/blogs/:id
exports.deleteBlog = async (req, res) => {
  try {
    await Blog.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Blog deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};