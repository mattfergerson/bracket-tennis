import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, Clock, CheckCircle, XCircle, Inbox } from "lucide-react";
import { approveRequest, denyRequest } from "./actions";

const STATUS_STYLES = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  DENIED: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_ICONS = {
  PENDING: Clock,
  APPROVED: CheckCircle,
  DENIED: XCircle,
};

export default async function AdminRequestsPage() {
  const requests = await prisma.accessRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const pending = requests.filter((r) => r.status === "PENDING");
  const reviewed = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Inbox className="h-8 w-8 text-yellow-500" />
          Access Requests
        </h1>
        <p className="text-muted-foreground mt-1">
          {pending.length} pending request{pending.length !== 1 ? "s" : ""}
        </p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg">No requests yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Pending</h2>
              <div className="space-y-3">
                {pending.map((req) => (
                  <RequestCard key={req.id} req={req} showActions />
                ))}
              </div>
            </section>
          )}

          {reviewed.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 text-muted-foreground">
                Reviewed
              </h2>
              <div className="space-y-3">
                {reviewed.map((req) => (
                  <RequestCard key={req.id} req={req} showActions={false} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  req,
  showActions,
}: {
  req: {
    id: string;
    email: string;
    name: string | null;
    message: string | null;
    status: "PENDING" | "APPROVED" | "DENIED";
    createdAt: Date;
  };
  showActions: boolean;
}) {
  const StatusIcon = STATUS_ICONS[req.status];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {req.email}
            </CardTitle>
            {req.name && (
              <CardDescription className="mt-0.5">{req.name}</CardDescription>
            )}
          </div>
          <Badge className={STATUS_STYLES[req.status]}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {req.message && (
          <p className="text-sm text-muted-foreground mb-3 italic">
            &ldquo;{req.message}&rdquo;
          </p>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {new Date(req.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          {showActions && (
            <div className="flex gap-2">
              <form action={denyRequest}>
                <input type="hidden" name="id" value={req.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  Deny
                </Button>
              </form>
              <form action={approveRequest}>
                <input type="hidden" name="id" value={req.id} />
                <Button
                  type="submit"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Approve
                </Button>
              </form>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
