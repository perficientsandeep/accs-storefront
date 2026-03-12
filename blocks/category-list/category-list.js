import { createOptimizedPicture } from '../../scripts/aem.js';

export default async function decorate(block) {
  // 1. Define the GraphQL query
  const GQL_QUERY = `
    {
      categories(filters: {parent_id: {eq: "3"}}) {
        items {
          name
          url_path
          children {
            name
            url_path
          }
        }
      }
    }
  `;

  // 2. Fetch data from Magento
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: GQL_QUERY }),
  });

  const { data } = await response.json();
  const categories = data?.categories?.items || [];

  // 3. Clear existing block content and render categories
  block.textContent = '';
  const list = document.createElement('ul');
  list.className = 'category-items';

  categories.forEach((cat) => {
    const item = document.createElement('li');
    item.innerHTML = `<a href="/${cat.url_path}">${cat.name}</a>`;
    
    // Optional: Render subcategories
    if (cat.children && cat.children.length > 0) {
      const subList = document.createElement('ul');
      cat.children.forEach(sub => {
        subList.innerHTML += `<li><a href="/${sub.url_path}">${sub.name}</a></li>`;
      });
      item.append(subList);
    }
    list.append(item);
  });

  block.append(list);
}
