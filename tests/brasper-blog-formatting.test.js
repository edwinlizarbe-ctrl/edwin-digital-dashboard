import test from 'node:test';
import assert from 'node:assert/strict';
import {articleToHtml,generateBlogHtml} from '../brasper-blog-generator.js';
const base={language:'pt',title:'Como enviar dinheiro para o Peru',article:'# Como enviar dinheiro para o Peru\n\nEm **outubro** veja a [Brasper](https://brasper.com/) e *compare* as opções.\n\n## 1. Cobertura Nacional\n\n- Atendimento em todo Brasil\n- Envio com **facilidade**\n\n### Nota de segurança\n\nSeu texto permanece seu.',related:[]};
test('Markdown pasted directly: title deduplicated, bold, italics, links, h2/h3 and bullets',()=>{
 const html=generateBlogHtml(base);
 assert.equal((html.match(/<h1>/g)||[]).length,1);
 assert.match(html,/<h1>Como enviar dinero para o Peru<\/h1>/);
 assert.doesNotMatch(html,/<p># Como/);
 assert.match(html,/<strong>outubro<\/strong>/);
 assert.match(html,/<em>compare<\/em>/);
 assert.match(html,/<a href="https:\/\/brasper\.com\/" target="_blank" rel="noopener noreferrer">Brasper<\/a>/);
 assert.match(html,/<h2>1\. Cobertura Nacional<\/h2>/);
 assert.match(html,/<h3>Nota de segurança<\/h3>/);
 assert.match(html,/<li>Envio com <strong>facilidade<\/strong><\/li>/);
});
test('input lines without blank line form one paragraph while blank lines split sections',()=>{
 assert.equal(articleToHtml('Uma linha\noutra linha\n\nNova ideia'),'<p>Uma linha outra linha</p>\n<p>Nova ideia</p>');
});
test('rejects unsafe Markdown links but preserves user text safely',()=>{
 const html=generateBlogHtml({...base,article:'Veja [clique](javascript:alert) e [perigo](data:text/html) e <script>alert(1)</script>'});
 assert.doesNotMatch(html,/<script>|href="javascript:|href="data:/);
 assert.match(html,/<p>Veja clique e perigo e &lt;script&gt;alert\(1\)&lt;\/script&gt;<\/p>/);
 assert.match(html,/&lt;script&gt;/);
});
test('numbered lists render semantically and keep numbers when starting later',()=>{
 assert.match(articleToHtml('3. Terceiro\n4. Quarto'),/<ol start="3"><li>Terceiro<\/li><li>Quarto<\/li><\/ol>/);
});
test('title always emits one H1 even when pasted article repeats it',()=>{
 const html=generateBlogHtml({...base,include_title:true});
 assert.equal((html.match(/<h1>/g)||[]).length,1);
});
