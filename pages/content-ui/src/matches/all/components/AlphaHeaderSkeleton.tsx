import { Skeleton } from '@src/ui';

export const AlphaHeaderSkeleton = () => {
  return (
    <>
      {/* 标题行骨架 */}
      <div className="mt-2 flex items-center justify-between text-black">
        <Skeleton.Text className="h-4 w-28 text-[13px]" />
        <div className="flex items-center gap-2">
          <Skeleton.Circle className="h-[14px] w-[14px]" />
          <Skeleton.Text className="h-4 w-24 text-[12px]" />
        </div>
      </div>

      {/* Worst Token 卡片骨架 */}
      <div className="flex h-[100px] flex-col rounded-[8px] border-[2px] border-solid border-black">
        {/* 黑色背景区域 */}
        <div className="mx-[1px] mt-[1px] flex h-[68px] items-center justify-center gap-2 rounded-[6px]">
          <Skeleton.Circle className="h-[18px] w-[18px]" />
          <Skeleton.Text className="h-5 w-28 text-[17px]" />
        </div>

        {/* Token 标签列表骨架 */}
        <div className="flex h-full items-center justify-center gap-3 text-[14px]">
          <Skeleton className="h-[2.5vh] w-16 rounded-full border-[2px] border-solid border-black" />
          <Skeleton className="h-[2.5vh] w-20 rounded-full border-[2px] border-solid border-black" />
          <Skeleton className="h-[2.5vh] w-16 rounded-full border-[2px] border-solid border-black" />
          <Skeleton className="h-[2.5vh] w-16 rounded-full border-[2px] border-solid border-black" />
          <Skeleton className="h-[2.5vh] w-16 rounded-full border-[2px] border-solid border-black" />
        </div>
      </div>
    </>
  );
};
