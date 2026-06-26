/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Terminal, Copy, Check, Eye, EyeOff } from 'lucide-react';

interface JSONInspectorProps {
  inputPayload: any;
  outputPayload: any;
}

export default function JSONInspector({ inputPayload, outputPayload }: JSONInspectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedSection, setCopiedSection] = useState<'input' | 'output' | null>(null);

  const copyToClipboard = (text: string, type: 'input' | 'output') => {
    navigator.clipboard.writeText(text);
    setCopiedSection(type);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="border border-[#333] rounded-sm bg-[#141414] overflow-hidden mt-8" id="json-inspector-container">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-[#1A1A1A] hover:bg-[#222] transition-colors text-left"
        id="btn-toggle-json-inspector"
      >
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-[#666]" />
          <span className="font-bold text-white text-xs uppercase tracking-wider">Clutch data protocol (Raw JSON inspector)</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[#666] font-bold uppercase tracking-wider">
          {isOpen ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Hide schema payloads</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect API payload</span>
            </>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="grid grid-cols-1 lg:grid-cols-2 border-t border-[#333] divide-y lg:divide-y-0 lg:divide-x divide-[#333] bg-[#0D0D0D] font-mono text-[11px] text-[#E0E0E0]">
          {/* Input Payload */}
          <div className="p-4 flex flex-col h-[320px]">
            <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-[#333]">
              <span className="text-[#10B981] font-bold text-[10px] tracking-wider uppercase">API Input Payload (ClutchRequest)</span>
              <button
                onClick={() => copyToClipboard(JSON.stringify(inputPayload, null, 2), 'input')}
                className="text-[#666] hover:text-white transition-colors p-1"
                title="Copy input payload"
                id="btn-copy-json-input"
              >
                {copiedSection === 'input' ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <pre className="overflow-y-auto flex-1 scrollbar-thin leading-relaxed select-all">
              {JSON.stringify(inputPayload, null, 2)}
            </pre>
          </div>

          {/* Output Payload */}
          <div className="p-4 flex flex-col h-[320px]">
            <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-[#333]">
              <span className="text-[#10B981] font-bold text-[10px] tracking-wider uppercase">API Output Payload (ClutchResponse)</span>
              <button
                onClick={() => copyToClipboard(JSON.stringify(outputPayload, null, 2), 'output')}
                className="text-[#666] hover:text-white transition-colors p-1"
                title="Copy output payload"
                id="btn-copy-json-output"
              >
                {copiedSection === 'output' ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <pre className="overflow-y-auto flex-1 scrollbar-thin leading-relaxed select-all">
              {outputPayload ? JSON.stringify(outputPayload, null, 2) : "/* Click 'Query Clutch engine' or run a scenario to query the Clutch engine */"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
