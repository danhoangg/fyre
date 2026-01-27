import { Alert, AlertDescription } from "@/components/ui/alert";

export function ErrorComponent({ message }: { message: string }) {
    return (
        <Alert className="my-2 border-red-500 bg-red-50">
            <AlertDescription className="text-red-700">
                {message}
            </AlertDescription>
        </Alert>
    );
}