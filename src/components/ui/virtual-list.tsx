import React, { forwardRef } from 'react';
import { FixedSizeList as List } from 'react-window';

interface VirtualListProps {
  items: any[];
  height: number;
  width?: number;
  itemHeight: number;
  renderItem: (props: { index: number; style: React.CSSProperties; data: any[] }) => React.ReactElement;
  className?: string;
}

export const VirtualList = forwardRef<List, VirtualListProps>(
  ({ items, height, width = "100%", itemHeight, renderItem, className }, ref) => {
    if (items.length === 0) {
      return (
        <div className={`flex items-center justify-center ${className}`} style={{ height }}>
          <p className="text-muted-foreground">No data available</p>
        </div>
      );
    }

    return (
      <List
        ref={ref}
        className={className}
        height={height}
        width={width}
        itemCount={items.length}
        itemSize={itemHeight}
        itemData={items}
      >
        {renderItem}
      </List>
    );
  }
);

VirtualList.displayName = 'VirtualList';