const fs = require('fs');
const path = require('path');

// Extract all problems from seed2.ts and seed3.ts
const extractProblems = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const regex = /{\s*roadmapOrder:.*?\s*}/gs;
  const problems = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const block = match[0];
    const titleMatch = block.match(/title:\s*"([^"]+)"/);
    const urlMatch = block.match(/platformUrl:\s*(leetcode|gfg)\("([^"]+)"\)/);
    if (titleMatch && urlMatch) {
      problems.push({
        file: filePath,
        title: titleMatch[1],
        platform: urlMatch[1],
        slug: urlMatch[2],
        fullBlock: block
      });
    }
  }
  return { content, problems };
};

const delay = ms => new Promise(res => setTimeout(res, ms));

async function verifyLeetCode(slug) {
  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `query { question(titleSlug: "${slug}") { titleSlug } }` })
    });
    const json = await res.json();
    return json?.data?.question !== null;
  } catch(e) {
    return false; // Error means can't verify, assume false or retry
  }
}

async function verifyGFG(slug) {
  try {
    const res = await fetch(`https://www.geeksforgeeks.org/problems/${slug}/1`);
    const html = await res.text();
    if (html.includes("<title>Practice | GeeksforGeeks | A computer science portal for geeks</title>")) {
      return false; // Broken
    }
    return true; // Valid
  } catch(e) {
    return false;
  }
}

async function searchSlug(title, platform) {
  const site = platform === 'leetcode' ? 'leetcode.com/problems' : 'geeksforgeeks.org/problems';
  const q = encodeURIComponent(`site:${site} "${title}"`);
  try {
    // Basic duckduckgo html search
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    const html = await res.text();
    // Look for urls
    if (platform === 'leetcode') {
        const match = html.match(/leetcode\.com\/problems\/([^/"]+)/);
        if (match && match[1]) return match[1];
    } else {
        const match = html.match(/geeksforgeeks\.org\/problems\/([^/"]+)/);
        if (match && match[1]) return match[1];
    }
  } catch (e) {
    console.error("Search failed for", title);
  }
  return null;
}

async function run() {
  const files = [
    path.join(__dirname, 'src', 'api', 'seed2.ts'),
    path.join(__dirname, 'src', 'api', 'seed3.ts')
  ];

  let totalChecked = 0;
  let totalBroken = 0;
  let totalFixed = 0;

  for (const filePath of files) {
    console.log(`Processing ${path.basename(filePath)}...`);
    let { content, problems } = extractProblems(filePath);
    let modified = false;

    // Check concurrently in batches of 10
    for (let i = 0; i < problems.length; i += 10) {
      const batch = problems.slice(i, i + 10);
      const results = await Promise.all(batch.map(async p => {
        let isValid = false;
        if (p.platform === 'leetcode') {
          isValid = await verifyLeetCode(p.slug);
        } else {
          isValid = await verifyGFG(p.slug);
        }
        return { problem: p, isValid };
      }));

      for (const res of results) {
        totalChecked++;
        if (!res.isValid) {
          totalBroken++;
          console.log(`[BROKEN] ${res.problem.platform}: ${res.problem.title} (${res.problem.slug})`);
          
          // Try to fix
          await delay(2000); // 2 second delay for searches
          const newSlug = await searchSlug(res.problem.title, res.problem.platform);
          
          if (newSlug && newSlug !== res.problem.slug) {
             console.log(`  -> Found fix: ${newSlug}`);
             const newBlock = res.problem.fullBlock.replace(
               `${res.problem.platform}("${res.problem.slug}")`,
               `${res.problem.platform}("${newSlug}")`
             );
             content = content.replace(res.problem.fullBlock, newBlock);
             modified = true;
             totalFixed++;
          } else {
             console.log(`  -> Could not find a fix.`);
          }
        }
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`Saved fixes to ${path.basename(filePath)}`);
    }
  }

  console.log(`\nVerification Complete.`);
  console.log(`Checked: ${totalChecked}`);
  console.log(`Broken:  ${totalBroken}`);
  console.log(`Fixed:   ${totalFixed}`);
}

run();
