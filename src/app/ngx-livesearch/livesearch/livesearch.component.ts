import { Component, OnInit, Input, HostListener, Output, 
        EventEmitter, OnDestroy, ElementRef, ContentChild, 
        TemplateRef, Optional, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs/Rx';
import { Subscription } from 'rxjs/Subscription';

import { trigger, style, transition, animate, keyframes, query, stagger } from '@angular/animations';
import { RequestService } from '../services/request.service';
import { Router } from '@angular/router';
import { SearchResultHighlightDirective } from '../directives/search-result-highlight.directive';


@Component({
  selector: 'livesearch',
  templateUrl: './livesearch.component.html',
  styleUrls: ['./livesearch.component.css'],
  animations: [
    trigger('listAnimation', [
      transition('* => *', [
        query(':enter', style({ opacity: 0 }), {optional: true}),
        query(':enter', stagger('30ms', [
          animate('.2s ease-in', keyframes([
            style({opacity: 0, transform: 'translateY(-75%)', offset: 0}),
            style({opacity: 1, transform: 'translateY(0)',     offset: 1.0}),
          ]))]), {optional: true})
      ])
    ])

  ]
})
export class LivesearchComponent implements OnInit, OnDestroy {
    @ViewChild('searchText')  searchInputEl: ElementRef;
    @Input() searchUrl :string;
    @Input() localSource: Array<any>;
    @ContentChild(TemplateRef) template: TemplateRef<any>;
    @Input() textOptions;
    @Input() searchOptions;

    @Output() onSelect = new EventEmitter();
    showEmptyMessage: boolean;
    seeAllParams;
    searchResult = [];
    searchAllResult = [];
    limitStart: number = 0;
    loading = false;
    allItems = false;
    visible = true;
    invalidSearchUrl = false;
    loadingSubscription: Subscription;
    lazyLoadOffset = 2;
    searchInput: FormControl = new FormControl('');
    searchMode: string;
    defaultSearchOptions = {
        searchParam: 'name',
        interval: 400,
        limit: 10,
        seeAllUrl: null,
        seeAllParams: {},
        seeAllPassSearchValue: true
    }
    
    defaultTextOptions = {
        seeAll: 'See all',
        noResults: 'No results',
        placeholder: 'Search'
    };

    @HostListener('document:click', ['$event.target'])
    doumentClicked(target) {
        if(!this.elRef.nativeElement.contains(target)) {
            this.visible = false;
        }
    }

    constructor(private requestService: RequestService,
                @Optional() private router: Router,
                private elRef: ElementRef
               ) { }

    ngOnInit() {
        this.searchOptions = Object.assign(this.defaultSearchOptions, this.searchOptions);
        this.textOptions = Object.assign(this.defaultTextOptions, this.textOptions);
        this.loadingSubscription = this.requestService.requestStartObs.subscribe(() => this.loading = true);
        this.init();
        this.isUrlValid();
    }

    private init() {
        this.configureSearchService();
    }

    public getSearchParams () {
        if(this.searchOptions.seeAllPassSearchValue) {
            let key = this.searchOptions.searchParam;
            this.searchOptions.seeAllParams[key] = this.searchInput.value;
        }
        return this.searchOptions.seeAllParams;
    }

    public keyPressedOnSearchInput (event: KeyboardEvent) {
        if(event.keyCode != 40 || !this.searchResult.length) return
        let firstSearchItem = document.querySelector('.firstSearchResult') as HTMLBaseElement;
        firstSearchItem.focus();
        event.preventDefault();
    }

    public keyPressedOnSearchResult (event: KeyboardEvent) {
        let keycode = event.keyCode;
        if([38, 40].indexOf(keycode) == -1) return
        let target = event.currentTarget as HTMLBaseElement;
        event.preventDefault();
        keycode == 38 ? this.naviagteTop(target) : this.navigateBottom(target);
    }

    public naviagteTop(target) {
        let prev = target.previousElementSibling  as HTMLBaseElement;
        if(prev && prev.tagName == 'LI') {
            prev.focus();
        }
        if(prev === null) {
            this.searchInputEl.nativeElement.focus();
        }
    }

    public navigateBottom(target: HTMLBaseElement) {
        let next = target.nextElementSibling  as HTMLBaseElement;
        if(next && next.tagName == 'LI') {
            next.focus();
        }
        if(next === null && !this.allItems) {
           this.searchMode == 'remote' ? this.remoteSearchHandle() : this.localSearchHandle();
        }
    }

    public configureSearchService () {
        this.requestService.timeToWait = this.searchOptions.interval;
        this.requestService.limit = this.searchOptions.limit;
        if(this.searchUrl) {
            this.searchMode = 'remote';
            this.requestService.searchUrl = this.searchUrl;
            this.requestService.searchParam = this.searchOptions.searchParam;
            this.requestService.search(this.searchInput.valueChanges)
                .subscribe(this.searchFinished.bind(this))
        } else {
            this.searchInput.valueChanges.subscribe(this.localSourceHandler.bind(this));
        }
    }  

    public searchResultSelected(selectedItem) {
        this.onSelect.emit(selectedItem);
    }

    public localSourceHandler (query: string) {
        if(!query) return this.searchFinished([])
        this.requestService.searchValue = query;
        let retVal = this.localSource.filter(data => data.indexOf(query) != -1);
        this.searchFinished(retVal);
    }

    public searchFinished (results: Array<any>) {
        this.loading = false;
        this.limitStart = 0;
        this.lazyLoadOffset = 2;
        this.allItems = false;
        this.searchAllResult = results;
        this.searchResult = [];
        if(this.searchMode == 'remote') {
            this.searchResult = this.searchAllResult;
        } else {
            this.localSearchHandle();
        }
        this.visible = true;
        this.showEmptyMessage = results.length || !this.searchInput.value ? false : true;
    }

    public remoteSearchHandle() {
        this.loading = true;
        setTimeout(() => {
            this.requestService.lazyLoad(this.lazyLoadOffset++).subscribe((result: Array<any>) => {
                if(result.length < this.searchOptions.limit) {
                    this.allItems = true;
                }
                this.searchResult.push(...result);
                this.loading = false;
            })
        }, 100)

    }

    public localSearchHandle() {
        if(!this.searchAllResult.length) {
            this.searchResult = [];
        }
        let limitedResult = this.searchAllResult.slice(this.limitStart, this.limitStart + this.searchOptions.limit);
        this.limitStart += this.searchOptions.limit;
        if(limitedResult.length < this.searchOptions.limit) this.allItems = false;
        this.searchResult.push(...limitedResult);
    }

    public clearSearch () {
        this.searchInput.setValue('');
    }

    public inputFocused() {
        this.searchResult.length && (this.visible = true);
    }

    public navigateToSeeAll() {
        let queryParams = this.getSearchParams();
        this.router.navigate([this.searchOptions.seeAllUrl], { queryParams: queryParams});
    }

    ngOnDestroy() {
        this.loadingSubscription.unsubscribe();
    }

    isUrlValid () {
        var regexp = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/;
        if(this.searchUrl) {
            regexp.test(this.searchUrl) || (this.invalidSearchUrl = true);
            this.searchUrl.startsWith('www') && (this.searchUrl = 'http://' + this.searchUrl);
        }
    }

}
