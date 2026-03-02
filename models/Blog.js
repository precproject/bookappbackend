const mongoose = require('mongoose');
const slugify = require('slugify');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true
    },

    slug: {
      type: String,
      unique: true,
      index: true
    },

    excerpt: {
      type: String,
      required: [true, 'Excerpt is required'],
      trim: true
    },

    content: {
      type: String,
      required: [true, 'Content is required'] // HTML from editor
    },

    featuredImage: {
      type: String,
      required: [true, 'Featured image URL is required']
    },

    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true
    },

    tags: [
      {
        type: String,
        trim: true
      }
    ],

    readTime: {
      type: String,
      default: '5 min read'
    },

    author: {
      name: {
        type: String,
        required: true,
        default: 'Admin'
      },
      avatar: {
        type: String,
        default:
          'https://ui-avatars.com/api/?name=Admin&background=0f172a&color=fff'
      }
    },

    isPublished: {
      type: Boolean,
      default: true
    },

    publishedAt: {
      type: Date,
      default: Date.now
    },
    type: { 
      type: String, 
      enum: ['text', 'video', 'audio'], 
      default: 'text' 
    }
  },
  {
    timestamps: true
  }
);


// 🔹 Auto-generate slug before validation
blogSchema.pre('validate', function () {
  if (this.title && !this.slug) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,   // removes special characters
      locale: 'mr'    // supports Marathi
    });
  }
});


// 🔹 Ensure slug updates if title changes
blogSchema.pre('save', function () {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
      locale: 'mr'
    });
  }
});


module.exports = mongoose.model('Blog', blogSchema);