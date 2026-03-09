import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const amenitiesList = ["Projector", "Whiteboard", "Video Conference System", "TV Screen", "Speakerphone"];

export interface RoomFormValues {
  roomNumber: string;
  roomType: string;
  capacity: number;
  country: string;
  branch: string;
  block: string;
  floor: string;
  imageUrl: string;
  isActive: boolean;
  amenities: string[];
}

interface RoomFormProps {
  onSubmit?: (values: RoomFormValues) => Promise<void> | void;
  onCancel?: () => void;
  initialValues?: Partial<RoomFormValues>;
  submitLabel?: string;
}

export function RoomForm({ onSubmit, onCancel, initialValues, submitLabel = "Create Room" }: RoomFormProps) {
  const [values, setValues] = useState<RoomFormValues>({
    roomNumber: initialValues?.roomNumber || "Room A",
    roomType: initialValues?.roomType || "Conference Room",
    capacity: initialValues?.capacity || 8,
    country: initialValues?.country || "United States",
    branch: initialValues?.branch || "HQ",
    block: initialValues?.block || "C Block",
    floor: initialValues?.floor || "3rd Floor",
    imageUrl: initialValues?.imageUrl || "",
    isActive: initialValues?.isActive ?? true,
    amenities: initialValues?.amenities || amenitiesList,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleAmenity = (amenity: string) => {
    setValues((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity) ? prev.amenities.filter((a) => a !== amenity) : [...prev.amenities, amenity],
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="bg-card rounded-xl border border-border p-6 space-y-6" onSubmit={submit}>
      <div>
        <Label className="text-sm font-semibold text-card-foreground">Room Name</Label>
        <Input
          placeholder="Enter room name"
          className="mt-2"
          value={values.roomNumber}
          onChange={(e) => setValues((prev) => ({ ...prev, roomNumber: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-semibold text-card-foreground">Room Type</Label>
          <Select value={values.roomType} onValueChange={(v) => setValues((prev) => ({ ...prev, roomType: v }))}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Conference Room">Conference Room</SelectItem>
              <SelectItem value="Meeting Room (10 members)">Meeting Room (10 members)</SelectItem>
              <SelectItem value="Meeting Room (5 members)">Meeting Room (5 members)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-semibold text-card-foreground">Capacity</Label>
          <Input
            type="number"
            value={values.capacity}
            className="mt-2"
            onChange={(e) => setValues((prev) => ({ ...prev, capacity: Number(e.target.value || 0) }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div>
          <Label className="text-sm font-semibold text-card-foreground">Location</Label>
          <Select value={values.country} onValueChange={(v) => setValues((prev) => ({ ...prev, country: v }))}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="United States">United States</SelectItem>
              <SelectItem value="Japan">Japan</SelectItem>
              <SelectItem value="India">India</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-semibold text-card-foreground">&nbsp;</Label>
          <Select value={values.branch} onValueChange={(v) => setValues((prev) => ({ ...prev, branch: v }))}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HQ">HQ</SelectItem>
              <SelectItem value="Branch">Branch</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-semibold text-card-foreground">Block</Label>
          <Select value={values.block} onValueChange={(v) => setValues((prev) => ({ ...prev, block: v }))}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A Block">A Block</SelectItem>
              <SelectItem value="B Block">B Block</SelectItem>
              <SelectItem value="C Block">C Block</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-semibold text-card-foreground">Room Number</Label>
          <div className="flex gap-2 mt-2">
            <Select value={values.floor} onValueChange={(v) => setValues((prev) => ({ ...prev, floor: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1st Floor">1st Floor</SelectItem>
                <SelectItem value="2nd Floor">2nd Floor</SelectItem>
                <SelectItem value="3rd Floor">3rd Floor</SelectItem>
              </SelectContent>
            </Select>
            <Input value={values.roomNumber} onChange={(e) => setValues((prev) => ({ ...prev, roomNumber: e.target.value }))} />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold text-card-foreground">Amenities</Label>
        <div className="grid grid-cols-3 gap-3 mt-3 bg-secondary/50 rounded-lg p-4">
          {amenitiesList.map((amenity) => (
            <label key={amenity} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={values.amenities.includes(amenity)} onCheckedChange={() => toggleAmenity(amenity)} />
              <span className="text-sm text-card-foreground">{amenity}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label className="text-sm font-semibold text-card-foreground">Room Status</Label>
          <Select value={values.isActive ? "active" : "inactive"} onValueChange={(v) => setValues((prev) => ({ ...prev, isActive: v === "active" }))}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Label className="text-sm font-semibold text-card-foreground mt-4 block">Room Image URL</Label>
          <Input
            className="mt-2"
            placeholder="https://example.com/room.jpg"
            value={values.imageUrl}
            onChange={(e) => setValues((prev) => ({ ...prev, imageUrl: e.target.value }))}
          />
        </div>
        <div className="border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-medium text-card-foreground">Image Preview</p>
          <p className="text-xs text-muted-foreground mb-3">Paste a direct image URL to use it for this room.</p>
          {values.imageUrl ? (
            <img src={values.imageUrl} alt={values.roomNumber || "Room preview"} className="h-28 w-full rounded-md object-cover" />
          ) : (
            <p className="text-xs text-muted-foreground">No image URL set</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
