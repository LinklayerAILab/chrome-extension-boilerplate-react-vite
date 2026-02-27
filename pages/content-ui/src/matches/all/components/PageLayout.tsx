export const PageLayout = ({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) => (
  <div className="flex flex-col gap-[1vh]">
    <div className="h-[140px] bg-[#cf0] p-4">{header}</div>
    <div
      className="custom-scrollbar-light h-[calc(100vh-140px)] w-[432px] overflow-y-auto pl-[16px] pr-[16px]"
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#ccc #f1f5f9', // Firefox: thumb color, track color (slate-300, slate-100)
      }}>
      <style>{`
        .custom-scrollbar-light::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar-light::-webkit-scrollbar-track {
          background: #f1f5f9; /* slate-100 */
        }
        .custom-scrollbar-light::-webkit-scrollbar-thumb {
          background: #cbd5e1; /* slate-300 */
          border-radius: 4px;
        }
        .custom-scrollbar-light::-webkit-scrollbar-thumb:hover {
          background: #ccc; /* slate-400 */
        }
      `}</style>
      {children}
    </div>
  </div>
);
