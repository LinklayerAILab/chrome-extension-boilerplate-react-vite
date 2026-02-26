export const AlphaBg = (props: { title: string; description: string; icon: string }) => {
  return (
    <div className="relative h-[120px] w-full rounded-b-lg">
      <img src={props.icon} alt="icon" className="absolute right-[0] top-[-10px] h-[120px] w-[120px] rounded-b-lg" />
      <div className="flex h-full w-[70%] flex-col justify-center gap-3 px-2 py-2">
        <h2 className="text-[26px] font-bold">{props.title}</h2>
        <p className="font-400 text-[15px]" style={{ fontWeight: 400 }}>
          {props.description}
        </p>
      </div>
    </div>
  );
};
