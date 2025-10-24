import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check } from 'lucide-react';
import 'highlight.js/styles/atom-one-light.css'; // Better contrast and readability

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom styling for different markdown elements
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 text-gray-900 border-b border-gray-200 pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0 text-gray-900 border-b border-gray-100 pb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0 text-gray-900">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mb-2 text-gray-900">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold mb-2 text-gray-900">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-semibold mb-2 text-gray-900">
              {children}
            </h6>
          ),
          p: ({ children }) => (
            <p className="mb-3 last:mb-0 leading-relaxed text-gray-800">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic">
              {children}
            </em>
          ),
          code: ({ inline, children, className, ...props }) => {
            if (inline) {
              return (
                <code 
                  className="bg-blue-50 text-blue-900 px-2 py-1 rounded text-sm font-mono border border-blue-200"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code 
                className={`${className} block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-gray-700 shadow-inner`}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => {
            // Extract text content from children for copying
            const getTextContent = (node: any): string => {
              if (typeof node === 'string') return node;
              if (Array.isArray(node)) return node.map(getTextContent).join('');
              if (node?.props?.children) return getTextContent(node.props.children);
              return '';
            };
            
            const codeText = getTextContent(children);
            const isCopied = copiedCode === codeText;
            
            return (
              <div className="relative mb-4 group">
                <pre className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700 shadow-lg">
                  {children}
                </pre>
                <button
                  onClick={() => copyToClipboard(codeText)}
                  className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title={isCopied ? 'Copied!' : 'Copy code'}
                >
                  {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-4 bg-blue-50 text-gray-700 italic">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="list-disc ml-4 mb-3 space-y-1 pl-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal ml-4 mb-3 space-y-1 pl-2">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="mb-1 leading-relaxed">
              {children}
            </li>
          ),
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="min-w-full text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 border-b border-gray-200">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-100 bg-white">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-gray-50 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-sm text-gray-900">
              {children}
            </td>
          ),
          a: ({ children, href }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {children}
            </a>
          ),
          hr: () => (
            <hr className="my-4 border-gray-200" />
          ),
          // Support for strikethrough (from remark-gfm)
          del: ({ children }) => (
            <del className="line-through text-gray-500">
              {children}
            </del>
          ),
        }}
        >
          {content}
        </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
