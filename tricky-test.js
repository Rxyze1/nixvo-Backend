import axios from 'axios';

async function testLlama(message, description) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📝 Test: ${description}`);
  console.log(`💬 Message: "${message}"`);
  console.log('⏳ Asking AI...\n');
  
  const prompt = `You are a highly skilled content moderator for a freelance platform. Your job is to detect ANY attempt to share contact information or move conversations off-platform.

BLOCK if message contains or hints at:
- Phone numbers (digits, spelled out, obfuscated, mixed languages)
- Email addresses (any format, obfuscated)
- Social media handles/requests
- URLs, links, or website references
- Requests to communicate elsewhere
- Creative/indirect ways to share contact info
- Mixed language contact info (Hindi+English, regional languages)
- Encoded patterns

Message: "${message}"

Think carefully. Does this violate rules?
Answer ONLY: YES (to block) or NO (to allow)`;

  try {
    const startTime = Date.now();
    
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.2:3b',
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.2, // Slightly higher for better reasoning
        num_predict: 20
      }
    }, {
      timeout: 15000
    });
    
    const time = Date.now() - startTime;
    const answer = response.data.response.trim().toUpperCase();
    
    console.log(`🤖 AI Response: ${answer}`);
    console.log(`⏱️  Time: ${time}ms`);
    
    if (answer.includes('YES')) {
      console.log('✅ CORRECT - AI BLOCKED this tricky attempt!');
      return true;
    } else {
      console.log('❌ MISSED - AI did not catch this');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

console.log('\n🔥 TRICKY MODERATION TEST - Indirect Hints & Mixed Languages\n');

// ════════════════════════════════════════════════════════════════════
// LEVEL 1: Obfuscated Numbers
// ════════════════════════════════════════════════════════════════════

await testLlama(
  "My number is nine eight seven six five four three two one zero",
  "Spelled out phone number"
);

await testLlama(
  "Contact me: 98-76-54-32-10",
  "Phone with dashes"
);

await testLlama(
  "Call on nine eight double seven six five four three two",
  "Partially spelled with 'double'"
);

await testLlama(
  "My digits: 9 8 7 6 5 4 3 2 1 0",
  "Spaced out digits"
);

// ════════════════════════════════════════════════════════════════════
// LEVEL 2: Hindi/English Mix (Indian Context)
// ════════════════════════════════════════════════════════════════════

await testLlama(
  "Bhai mera number hai 9876543210",
  "Hindi + English phone"
);

await testLlama(
  "DM karo yaar, mera insta @rohan_dev hai",
  "Hindi + English social media"
);

await testLlama(
  "WhatsApp pe baat karte hain boss",
  "Hindi request for WhatsApp"
);

await testLlama(
  "Email bhejo: john dot kumar at gmail dot com",
  "Hindi + Obfuscated email"
);

await testLlama(
  "Mera naam Rohan hai aur number mil jayega profile mein",
  "Indirect hint - Hindi"
);

// ════════════════════════════════════════════════════════════════════
// LEVEL 3: Creative Obfuscation
// ════════════════════════════════════════════════════════════════════

await testLlama(
  "john [at] gmail [dot] com",
  "Email with brackets"
);

await testLlama(
  "My email: john(at)gmail(dot)com",
  "Email with parentheses"
);

await testLlama(
  "Reach me at john_AT_gmail_DOT_com",
  "Email all caps AT/DOT"
);

await testLlama(
  "My IG handle is the same as my name here",
  "Indirect social media reference"
);

await testLlama(
  "Search for me on that blue bird app @john_dev",
  "Twitter indirect reference"
);

await testLlama(
  "Find me on the professional network, username: john.kumar",
  "LinkedIn indirect hint"
);

// ════════════════════════════════════════════════════════════════════
// LEVEL 4: Off-Platform Requests
// ════════════════════════════════════════════════════════════════════

await testLlama(
  "Can we continue this discussion somewhere else?",
  "Vague off-platform request"
);

await testLlama(
  "Let's move this conversation to a better place",
  "Indirect off-platform hint"
);

await testLlama(
  "I prefer talking on other platforms",
  "Generic off-platform preference"
);

await testLlama(
  "Yahan discuss karna mushkil hai, somewhere else?",
  "Hindi + English off-platform"
);

// ════════════════════════════════════════════════════════════════════
// LEVEL 5: Super Tricky (Mix of everything)
// ════════════════════════════════════════════════════════════════════

await testLlama(
  "Bro last three digits are 210 and first is the number after eight, figure it out",
  "Math puzzle phone"
);

await testLlama(
  "My contact starts with country code +91 and then the city code for Mumbai",
  "Geographic hint"
);

await testLlama(
  "Check my bio for ways to reach me yaar",
  "Profile reference - Hindi"
);

await testLlama(
  "The green messaging app, you know which one ;)",
  "WhatsApp indirect"
);

await testLlama(
  "My number is the same as my birthdate: 15-08-1997, just remove the dashes",
  "Birthdate as phone hint"
);

await testLlama(
  "Just Google my name + developer, you'll find me",
  "Search engine indirect"
);

await testLlama(
  "Link in bio hai bhai, check kar lo",
  "Hindi - link in bio"
);

// ════════════════════════════════════════════════════════════════════
// LEVEL 6: Regional Languages
// ════════════════════════════════════════════════════════════════════

await testLlama(
  "Mujhe call karo 9876543210 par",
  "Hindi full sentence"
);

await testLlama(
  "WhatsApp karo yaar jaldi",
  "Hindi WhatsApp request"
);

await testLlama(
  "Telegram pe aao, ID same hai",
  "Hindi Telegram"
);

// ════════════════════════════════════════════════════════════════════
// LEVEL 7: Should be ALLOWED (Clean messages)
// ════════════════════════════════════════════════════════════════════

console.log('\n\n🟢 CLEAN MESSAGES (Should be ALLOWED):\n');

await testLlama(
  "The project timeline is 10 weeks",
  "Numbers in context (not phone)"
);

await testLlama(
  "I have 9 years of experience in development",
  "Experience mention"
);

await testLlama(
  "Budget is around 50000 rupees",
  "Budget discussion"
);

await testLlama(
  "Let's discuss the requirements in detail",
  "Normal discussion"
);

await testLlama(
  "Bhai project kab start hoga?",
  "Hindi project question"
);

await testLlama(
  "Can you share your portfolio?",
  "Portfolio request (normal)"
);

console.log('\n' + '='.repeat(70));
console.log('\n✅ ALL TESTS COMPLETE!\n');