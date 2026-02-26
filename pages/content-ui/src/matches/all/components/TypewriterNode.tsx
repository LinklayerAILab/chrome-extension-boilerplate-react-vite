import { useEffect, useRef, useState } from 'react';
import Typewriter from 'typewriter-effect';

interface TypewriterNodeProps {
  text: string;
  icon: string;
}

function TypewriterNode({ text, icon }: TypewriterNodeProps) {
  const typewriterRef = useRef<any | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    return () => {
      // 组件卸载时清理
      if (typewriterRef.current) {
        try {
          typewriterRef.current.stop();
          typewriterRef.current = null;
        } catch (error) {
          // 忽略清理错误
          console.log(error);
        }
      }
    };
  }, []);

  return (
    <div
      className="flex h-[60vh] w-[100%] items-center justify-center overflow-hidden lg:h-[73.4vh]"
      ref={containerRef}>
      <div className="relative flex h-[100%] w-[100%] items-center justify-center bg-[#F9FFE2]">
        <img src={icon} alt="" className="m-auto h-[62vh] w-[100%] object-contain" />
        <div className="absolute bottom-[10vh] left-[20px]">
          <Typewriter
            key={key}
            onInit={(typewriter: any) => {
              typewriterRef.current = typewriter;

              typewriter
                .typeString(text)
                .pauseFor(2000)
                .deleteAll(1) // 极快速度删除所有内容
                .pauseFor(500)
                .callFunction(() => {
                  // 重新开始下一轮
                  setTimeout(() => {
                    setKey(prev => prev + 1); // 强制重新渲染组件
                  }, 100);
                });
              typewriter.start();
            }}
            options={{
              autoStart: false,
              loop: false,
              delay: 50,
              wrapperClassName: 'text-[1.6vh] font-bold text-gray-600 text-left w-full leading-relaxed',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default TypewriterNode;
