import { Spinner } from "./spinner"

export function LoadingComponent({ text, ...props }: React.ComponentProps<"div"> & { text: string }) {
    return (
        <div className="flex justify-center py-8" {...props}>
            <div className="flex items-center gap-2">
                <Spinner />
                <span className="text-muted-foreground">{text}</span>
            </div>
        </div>
    )
}