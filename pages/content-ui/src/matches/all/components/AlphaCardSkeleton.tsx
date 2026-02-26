import { Skeleton } from '@src/ui';

export const AlphaCardSkeleton = () => {
  return (
    <div className="alpha-card flex gap-3 px-[14px] py-[14px] text-[12px] text-black">
      <div className="flex w-[110px] flex-col items-center justify-center gap-2 rounded-[8px] border-[2px] border-solid border-black p-[10px]">
        <Skeleton.Circle className="h-[4.3vh] w-[4.3vh] border-[2px] border-solid border-black" />
        <Skeleton.Circle className="h-[4vh] w-[4vh] border-[2px] border-solid border-black" />
      </div>
      <div className="alpha-card-content flex flex-1 flex-col gap-2">
        <div className="flex items-center justify-between rounded-[4px] py-2">
          <Skeleton.Text className="w-20 text-[12px]" />
          <Skeleton.Text className="w-12" />
        </div>
        <div className="flex items-center justify-between rounded-[4px] py-2">
          <Skeleton.Text className="w-16 text-[12px]" />
          <Skeleton.Text className="w-16" />
        </div>
        <div className="flex items-center justify-between rounded-[4px] py-2">
          <Skeleton.Text className="w-20 text-[12px]" />
          <Skeleton className="h-[2vh] w-20 rounded-full" />
        </div>

        <div className="flex items-center justify-between gap-2 py-2">
          <Skeleton.Button />
          <Skeleton.Button />
        </div>
      </div>
    </div>
  );
};
