import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BottomSheetComponent } from './features/bottom-sheet/bottom-sheet.component';
import { ControlPointSheetComponent } from './features/control-point/control-point-sheet.component';
import { HeaderComponent } from './features/header/header.component';
import { LineSelectorComponent } from './features/line-selector/line-selector.component';
import { MapViewComponent } from './features/map/map-view.component';
import { SearchBarComponent } from './features/search/search-bar.component';
import { SearchResultsComponent } from './features/search/search-results.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    HeaderComponent,
    LineSelectorComponent,
    MapViewComponent,
    BottomSheetComponent,
    ControlPointSheetComponent,
    SearchBarComponent,
    SearchResultsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
})
export class App {}
