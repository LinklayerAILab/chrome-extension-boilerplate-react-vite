import { classNames } from './utils';

export interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton = ({ className, style }: SkeletonProps) => {
  return <div className={classNames('animate-pulse rounded bg-gray-200', className)} style={style} />;
};

Skeleton.Button = ({ className, style }: SkeletonProps) => {
  return <Skeleton className={classNames('h-10 w-full', className)} style={style} />;
};

Skeleton.Input = ({ className, style }: SkeletonProps) => {
  return <Skeleton className={classNames('h-10 w-full', className)} style={style} />;
};

Skeleton.Text = ({ className, style }: SkeletonProps) => {
  return <Skeleton className={classNames('h-4 w-3/4', className)} style={style} />;
};

Skeleton.Circle = ({ className, style }: SkeletonProps) => {
  return <Skeleton className={classNames('rounded-full', className)} style={style} />;
};
